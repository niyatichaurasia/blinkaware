from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import socketio
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import base64
from fastapi import UploadFile, File
import base64
import numpy as np
import cv2


from auth import (
    hash_password, verify_password, 
    create_access_token, create_refresh_token,
    set_auth_cookies, clear_auth_cookies,
    get_current_user, check_brute_force,
    increment_login_attempts, clear_login_attempts,
    seed_admin
)
from ml_pipeline import initialize_ml_pipeline, get_ml_pipeline
from fastapi.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Initialize FastAPI
app = FastAPI(title="BlinkAware API")
api_router = APIRouter(prefix="/api")

# ==================== CORS ====================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],   # ✅ frontend URL,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Socket.IO
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=True,
    engineio_logger=False
)
socket_app = socketio.ASGIApp(
    sio,
    other_asgi_app=app
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== Pydantic Models ====================

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(alias="_id")
    email: str
    name: str
    role: str
    created_at: datetime

class SessionCreate(BaseModel):
    user_id: str

class SessionResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    start_time: datetime
    end_time: Optional[datetime] = None
    total_blinks: int = 0
    avg_blink_rate: float = 0.0
    status: str

class BlinkEvent(BaseModel):
    model_config = ConfigDict(extra="ignore")
    session_id: str
    timestamp: datetime
    confidence: float

class SettingsUpdate(BaseModel):
    alert_sensitivity: Optional[float] = None
    break_reminder_enabled: Optional[bool] = None
    break_interval_minutes: Optional[int] = None
    sound_alerts_enabled: Optional[bool] = None

class SettingsResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    alert_sensitivity: float
    break_reminder_enabled: bool
    break_interval_minutes: int
    sound_alerts_enabled: bool

# ==================== Helper Functions ====================

async def get_user_dependency(request: Request) -> dict:
    """Dependency to get current authenticated user."""
    return await get_current_user(request, db)

def object_id_to_str(doc: dict) -> dict:
    """Convert ObjectId fields to strings."""
    if doc and "_id" in doc:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
    return doc

# ==================== Auth Routes ====================

@api_router.post("/auth/register")
async def register(user_data: UserCreate, response: Response):
    """Register new user."""
    email_lower = user_data.email.lower()
    
    # Check if user exists
    existing = await db.users.find_one({"email": email_lower})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Hash password and create user
    password_hash = hash_password(user_data.password)
    user_doc = {
        "email": email_lower,
        "password_hash": password_hash,
        "name": user_data.name,
        "role": "user",
        "created_at": datetime.now(timezone.utc),
        "settings": {
            "alert_sensitivity": 0.7,
            "break_reminder_enabled": True,
            "break_interval_minutes": 20,
            "sound_alerts_enabled": True
        }
    }
    
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    
    # Create tokens
    access_token = create_access_token(user_id, email_lower)
    refresh_token = create_refresh_token(user_id)
    set_auth_cookies(response, access_token, refresh_token)
    
    # Return user data
    user_doc["_id"] = user_id
    user_doc.pop("password_hash")
    return object_id_to_str(user_doc)

@api_router.post("/auth/login")
async def login(credentials: UserLogin, request: Request, response: Response):
    """Login user."""
    email_lower = credentials.email.lower()
    
    # Check brute force
    identifier = f"{request.client.host}:{email_lower}"
    if await check_brute_force(db, identifier):
        raise HTTPException(status_code=429, detail="Too many failed attempts. Try again in 15 minutes.")
    
    # Find user
    user = await db.users.find_one({"email": email_lower})
    if not user:
        await increment_login_attempts(db, identifier)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Verify password
    if not verify_password(credentials.password, user["password_hash"]):
        await increment_login_attempts(db, identifier)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Clear failed attempts
    await clear_login_attempts(db, identifier)
    
    # Create tokens
    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email_lower)
    refresh_token = create_refresh_token(user_id)
    set_auth_cookies(response, access_token, refresh_token)
    
    # Return user data
    user["_id"] = user_id
    user.pop("password_hash")
    return object_id_to_str(user)

@api_router.post("/auth/logout")
async def logout(response: Response, user: dict = Depends(get_user_dependency)):
    """Logout user."""
    clear_auth_cookies(response)
    return {"message": "Logged out successfully"}

@api_router.get("/auth/me")
async def get_me(request: Request):
    user = await get_current_user_optional(request, db)
    return user

# ==================== Session Routes ====================

@api_router.post("/session/start")
async def start_session(user: dict = Depends(get_user_dependency)):
    """Start a new monitoring session."""
    # Check if there's an active session
    active_session = await db.sessions.find_one({
        "user_id": user["_id"],
        "end_time": None
    })
    
    if active_session:
        active_session["_id"] = str(active_session["_id"])
        return object_id_to_str(active_session)
    
    # Create new session
    session_doc = {
        "user_id": user["_id"],
        "start_time": datetime.now(timezone.utc),
        "end_time": None,
        "total_blinks": 0,
        "avg_blink_rate": 0.0,
        "status": "active"
    }
    
    result = await db.sessions.insert_one(session_doc)
    session_doc["_id"] = str(result.inserted_id)
    
    # Reset ML pipeline
    ml_pipeline = get_ml_pipeline()
    ml_pipeline.reset()
    
    return object_id_to_str(session_doc)

@api_router.post("/session/stop")
async def stop_session(user: dict = Depends(get_user_dependency)):
    try:
        session = await db.sessions.find_one({
            "user_id": user["_id"],
            "end_time": None
        })

        if not session:
            return {"message": "No active session"}

        session_id = str(session["_id"])
        session_obj_id = session["_id"]

        try:
            blinks = await db.blinks.find({"session_id": session_id}).to_list(length=10000)
            total_blinks = len(blinks)
        except Exception as e:
            print("BLINK FETCH ERROR:", e)
            total_blinks = 0

        start_time = session.get("start_time")

        # Normalize start_time → ALWAYS timezone-aware
        if start_time is None:
            raise Exception("start_time missing in session")

        if start_time.tzinfo is None:
            start_time = start_time.replace(tzinfo=timezone.utc)

        # Always use UTC
        end_time = datetime.now(timezone.utc)

        duration_seconds = (end_time - start_time).total_seconds()
        duration_minutes = duration_seconds / 60.0
        
        # Safe division
        avg_blink_rate = total_blinks / duration_minutes if duration_minutes > 0 else 0.0

        await db.sessions.update_one(
            {"_id": session_obj_id},
            {
                "$set": {
                    "end_time": end_time,
                    "total_blinks": total_blinks,
                    "avg_blink_rate": round(avg_blink_rate, 2),
                    "status": "completed"
                }
            }
        )

        return {
            "message": "Session stopped",
            "total_blinks": total_blinks,
            "avg_blink_rate": round(avg_blink_rate, 2)
        }

    except Exception as e:
        print("STOP SESSION ERROR:", e)
        raise HTTPException(status_code=500, detail=str(e))
    

@api_router.get("/session/current")
async def get_current_session(user: dict = Depends(get_user_dependency)):
    """Get current active session."""
    session = await db.sessions.find_one({
        "user_id": user["_id"],
        "end_time": None
    })
    
    if not session:
        return None
    
    session["_id"] = str(session["_id"])
    return object_id_to_str(session)

# ==================== Analytics Routes ====================

@api_router.get("/analytics/sessions")
async def get_sessions(
    limit: int = 10,
    user: dict = Depends(get_user_dependency)
):
    """Get user's session history."""
    sessions = await db.sessions.find({
        "user_id": user["_id"]
    }).sort("start_time", -1).limit(limit).to_list(limit)
    
    for session in sessions:
        session["_id"] = str(session["_id"])
        session = object_id_to_str(session)
    
    return sessions

@api_router.get("/analytics/daily")
async def get_daily_stats(user: dict = Depends(get_user_dependency)):
    """Get today's statistics."""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    sessions = await db.sessions.find({
        "user_id": user["_id"],
        "start_time": {"$gte": today_start}
    }).to_list(None)
    
    total_sessions = len(sessions)
    total_blinks = sum(s.get("total_blinks", 0) for s in sessions)
    total_duration = sum(
        ((s.get("end_time") or datetime.now(timezone.utc)) - s["start_time"]).total_seconds() / 60.0
        for s in sessions
    )
    avg_blink_rate = total_blinks / total_duration if total_duration > 0 else 0.0
    
    return {
        "date": today_start.isoformat(),
        "total_sessions": total_sessions,
        "total_blinks": total_blinks,
        "total_duration_minutes": round(total_duration, 2),
        "avg_blink_rate": round(avg_blink_rate, 2)
    }

@api_router.get("/analytics/weekly")
async def get_weekly_stats(user: dict = Depends(get_user_dependency)):
    """Get last 7 days statistics."""
    week_start = datetime.now(timezone.utc) - timedelta(days=7)
    
    sessions = await db.sessions.find({
        "user_id": user["_id"],
        "start_time": {"$gte": week_start}
    }).to_list(None)
    
    # Group by day
    daily_stats = {}
    for session in sessions:
        day = session["start_time"].replace(hour=0, minute=0, second=0, microsecond=0)
        day_key = day.isoformat()
        
        if day_key not in daily_stats:
            daily_stats[day_key] = {
                "date": day_key,
                "sessions": 0,
                "blinks": 0,
                "duration": 0.0
            }
        
        daily_stats[day_key]["sessions"] += 1
        daily_stats[day_key]["blinks"] += session.get("total_blinks", 0)
        duration = ((session.get("end_time") or datetime.now(timezone.utc)) - session["start_time"]).total_seconds() / 60.0
        daily_stats[day_key]["duration"] += duration
    
    # Calculate avg blink rate for each day
    for day_data in daily_stats.values():
        if day_data["duration"] > 0:
            day_data["avg_blink_rate"] = round(day_data["blinks"] / day_data["duration"], 2)
        else:
            day_data["avg_blink_rate"] = 0.0
    
    return list(daily_stats.values())

# ==================== Settings Routes ====================

@api_router.get("/settings")
async def get_settings(user: dict = Depends(get_user_dependency)):
    """Get user settings."""
    user_data = await db.users.find_one({"_id": ObjectId(user["_id"])})
    settings = user_data.get("settings", {})
    settings["user_id"] = user["_id"]
    return settings

@api_router.put("/settings")
async def update_settings(
    settings: SettingsUpdate,
    user: dict = Depends(get_user_dependency)
):
    """Update user settings."""
    update_data = settings.model_dump(exclude_none=True)
    
    if update_data:
        update_dict = {f"settings.{k}": v for k, v in update_data.items()}
        await db.users.update_one(
            {"_id": ObjectId(user["_id"])},
            {"$set": update_dict}
        )
    
    # Get updated settings
    user_data = await db.users.find_one({"_id": ObjectId(user["_id"])})
    updated_settings = user_data.get("settings", {})
    updated_settings["user_id"] = user["_id"]
    
    return updated_settings

# ==================== WebSocket Events ====================

@sio.event
async def connect(sid, environ):
    """Handle WebSocket connection."""
    logger.info(f"Client connected: {sid}")

@sio.event
async def disconnect(sid):
    """Handle WebSocket disconnection."""
    logger.info(f"Client disconnected: {sid}")

@sio.event
async def process_frame(sid, data):
    """Process video frame for blink detection."""
    try:
        # Extract frame data
        frame_data = data.get("frame")
        session_id = data.get("session_id")
        
        if not frame_data or not session_id:
            await sio.emit("error", {"message": "Missing frame or session_id"}, room=sid)
            return
        
        # Decode base64 frame
        frame_bytes = base64.b64decode(frame_data.split(",")[1] if "," in frame_data else frame_data)
        
        # Process with ML pipeline
        ml_pipeline = get_ml_pipeline()
        result = ml_pipeline.process_frame(frame_bytes)
        
        if result and result.get("is_blink"):
            # Save blink event
            blink_doc = {
                "session_id": session_id,
                "timestamp": datetime.now(timezone.utc),
                "confidence": result.get("confidence", 0.0)
            }
            await db.blinks.insert_one(blink_doc)
            
            # Update session blink count
            await db.sessions.update_one(
                {"_id": ObjectId(session_id)},
                {"$inc": {"total_blinks": 1}}
            )
            
            # Emit blink detected event
            await sio.emit("blink_detected", {
                "timestamp": blink_doc["timestamp"].isoformat(),
                "confidence": result.get("confidence", 0.0)
            }, room=sid)
            
            logger.info(f"Blink detected for session {session_id}")
    
    except Exception as e:
        logger.error(f"Error processing frame: {e}")
        await sio.emit("error", {"message": str(e)}, room=sid)

# ==================== Startup Events ====================

@app.on_event("startup")
async def startup_event():
    """Initialize application on startup."""
    logger.info("Starting BlinkAware backend...")
    
    # Seed admin user
    await seed_admin(db)
    logger.info("Admin user seeded")
    
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.sessions.create_index([("user_id", 1), ("start_time", -1)])
    await db.blinks.create_index([("session_id", 1), ("timestamp", -1)])
    logger.info("Database indexes created")
    
    # Initialize ML pipeline
    model_path = os.environ.get("MODEL_PATH", "model/blinkaware_cnn.h5")
    initialize_ml_pipeline(model_path)

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown."""
    client.close()
    logger.info("MongoDB connection closed")

# ==================== Include Routers ====================

app.include_router(api_router)

# ==================== Root Route ====================

@app.get("/")
async def root():
    return {"message": "BlinkAware API v1.0", "status": "running"}

@app.post("/api/blink/analyze")
async def analyze_blink(file: UploadFile = File(...)):
    try:
        contents = await file.read()

        pipeline = get_ml_pipeline()
        result = pipeline.process_frame(contents)

        return {
            "status": "success",
            "data": result
        }

    except Exception as e:
        return {"error": str(e)}