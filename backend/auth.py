import os
import jwt
import bcrypt
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import HTTPException, Request, Response
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

JWT_ALGORITHM = "HS256"

def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]

def hash_password(password: str) -> str:
    """Hash password using bcrypt."""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash."""
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

def create_access_token(user_id: str, email: str) -> str:
    """Create JWT access token (15 min expiry)."""
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15),
        "type": "access"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    """Create JWT refresh token (7 days expiry)."""
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def set_auth_cookies(response: Response, access_token: str, refresh_token: str):
    """Set authentication cookies on response."""
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=900,
        path="/"
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=604800,
        path="/"
    )

def clear_auth_cookies(response: Response):
    """Clear authentication cookies."""
    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/")

async def get_current_user(request: Request, db: AsyncIOMotorDatabase) -> dict:
    """Extract and verify JWT token, return user data."""
    # Try cookie first
    token = request.cookies.get("access_token")
    
    # Fallback to Authorization header
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        
        user_id = payload["sub"]
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        # Convert ObjectId to string and remove password
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        
        return user
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def check_brute_force(db: AsyncIOMotorDatabase, identifier: str) -> bool:
    """Check if login attempts exceed threshold."""
    attempt = await db.login_attempts.find_one({"identifier": identifier})
    
    if not attempt:
        return False
    
    # Check if locked out (5 attempts, 15 min lockout)
    if attempt["count"] >= 5:
        lockout_time = attempt["last_attempt"] + timedelta(minutes=15)
        if datetime.now(timezone.utc) < lockout_time:
            return True
        else:
            # Reset after lockout period
            await db.login_attempts.delete_one({"identifier": identifier})
    
    return False

async def increment_login_attempts(db: AsyncIOMotorDatabase, identifier: str):
    """Increment failed login attempts."""
    await db.login_attempts.update_one(
        {"identifier": identifier},
        {
            "$inc": {"count": 1},
            "$set": {"last_attempt": datetime.now(timezone.utc)}
        },
        upsert=True
    )

async def clear_login_attempts(db: AsyncIOMotorDatabase, identifier: str):
    """Clear login attempts on successful login."""
    await db.login_attempts.delete_one({"identifier": identifier})

async def seed_admin(db: AsyncIOMotorDatabase):
    """Seed admin user from environment variables."""
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@blinkaware.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "SecureAdmin123!")
    
    existing = await db.users.find_one({"email": admin_email})
    
    if existing is None:
        # Create new admin
        hashed = hash_password(admin_password)
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hashed,
            "name": "Admin User",
            "role": "admin",
            "created_at": datetime.now(timezone.utc),
            "settings": {
                "alert_sensitivity": 0.7,
                "break_reminder_enabled": True,
                "break_interval_minutes": 20,
                "sound_alerts_enabled": True
            }
        })
    elif not verify_password(admin_password, existing["password_hash"]):
        # Update password if changed in env
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}}
        )

async def get_current_user_optional(request: Request, db: AsyncIOMotorDatabase) -> Optional[dict]:
    try:
        return await get_current_user(request, db)
    except HTTPException:
        return None