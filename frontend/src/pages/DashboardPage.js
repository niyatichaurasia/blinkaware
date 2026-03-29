import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, Play, Square, Settings, BarChart3, LogOut, Camera, Wifi, WifiOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

axios.defaults.withCredentials = true;

export function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [session, setSession] = useState(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [blinkRate, setBlinkRate] = useState(0);
  const [status, setStatus] = useState('normal');
  const [chartData, setChartData] = useState([]);
  const [cameraError, setCameraError] = useState(null);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const frameIntervalRef = useRef(null);
  
  const { connected, sendFrame, blinkCount } = useWebSocket(session?.id);

  useEffect(() => {
    checkCurrentSession();
  }, []);

  useEffect(() => {
    if (session && isMonitoring) {
      startCamera();
    } else {
      stopCamera();
    }
  }, [session, isMonitoring]);

  useEffect(() => {
    if (session && blinkCount > 0) {
      updateBlinkRate();
    }
  }, [blinkCount]);

  const checkCurrentSession = async () => {
    try {
      const { data } = await axios.get(`${API}/session/current`);
      if (data) {
        setSession(data);
        setIsMonitoring(true);
      }
    } catch (error) {
      console.error('Error checking session:', error);
    }
  };

  const startMonitoring = async () => {
    try {
      const { data } = await axios.post(`${API}/session/start`);
      setSession(data);
      setIsMonitoring(true);
      toast.success('Monitoring started');
    } catch (error) {
      console.error('Error starting session:', error);
      toast.error('Failed to start monitoring');
    }
  };

  const stopMonitoring = async () => {
    try {
      await axios.post(`${API}/session/stop`);
      setSession(null);
      setIsMonitoring(false);
      stopCamera();
      toast.success('Monitoring stopped');
    } catch (error) {
      console.error('Error stopping session:', error);
      toast.error('Failed to stop monitoring');
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480 } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        // ✅ SAFE PLAY FIX
        videoRef.current.play().catch(() => {
          console.log("Video play interrupted (safe ignore)");
        });
        
        // Start sending frames
        frameIntervalRef.current = setInterval(() => {
          captureAndSendFrame();
        }, 200); // Send frame every 200ms
      }
      
      setCameraError(null);
    } catch (error) {
      console.error('Camera error:', error);
      setCameraError('Failed to access camera. Please grant camera permissions.');
      toast.error('Camera access denied');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
  };

  const captureAndSendFrame = () => {
    if (!videoRef.current || !canvasRef.current || !connected) return;
    
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    
    // Convert to base64
    const frameData = canvas.toDataURL('image/jpeg', 0.8);
    sendFrame(frameData);
  };

  const updateBlinkRate = () => {
    if (!session) return;
    
    const now = new Date();
    const startTime = new Date(session.start_time);
    const elapsedMinutes = (now - startTime) / 1000 / 60;
    const rate = blinkCount / elapsedMinutes;
    
    setBlinkRate(rate);
    
    // Update status based on blink rate
    if (rate < 10) {
      setStatus('warning');
    } else if (rate < 5) {
      setStatus('drowsy');
    } else {
      setStatus('normal');
    }
    
    // Update chart
    const timeLabel = now.toLocaleTimeString();
    setChartData(prev => {
      const newData = [...prev, { time: timeLabel, rate: rate.toFixed(1) }];
      return newData.slice(-20); // Keep last 20 data points
    });
  };

  const handleLogout = async () => {
    if (isMonitoring) {
      await stopMonitoring();
    }
    await logout();
    navigate('/');
  };

  const getStatusColor = () => {
    switch (status) {
      case 'normal': return 'text-green-400';
      case 'warning': return 'text-yellow-400';
      case 'drowsy': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusBgColor = () => {
    switch (status) {
      case 'normal': return 'bg-green-500/20';
      case 'warning': return 'bg-yellow-500/20';
      case 'drowsy': return 'bg-red-500/20';
      default: return 'bg-gray-500/20';
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-black/60 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
              <Eye className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold" style={{ fontFamily: 'Outfit, sans-serif' }}>BlinkAware</span>
          </div>
          
          <div className="flex items-center gap-4">
            <Link
              to="/analytics"
              data-testid="nav-analytics-btn"
              className="p-2 hover:bg-white/10 rounded-xl transition-colors"
            >
              <BarChart3 className="w-5 h-5" />
            </Link>
            <Link
              to="/settings"
              data-testid="nav-settings-btn"
              className="p-2 hover:bg-white/10 rounded-xl transition-colors"
            >
              <Settings className="w-5 h-5" />
            </Link>
            <button
              onClick={handleLogout}
              data-testid="logout-btn"
              className="p-2 hover:bg-white/10 rounded-xl transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-xl">
              <span className="text-sm text-gray-400">{user?.name}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Control Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex items-center justify-between"
        >
          <div>
            <h1 className="text-4xl font-bold mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Eye Monitoring
            </h1>
            <p className="text-gray-400" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Real-time blink detection and analysis
            </p>
          </div>
          
          {!isMonitoring ? (
            <button
              onClick={startMonitoring}
              data-testid="start-monitoring-btn"
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-xl hover:shadow-xl hover:shadow-blue-500/30 transition-all"
            >
              <Play className="w-5 h-5" />
              Start Monitoring
            </button>
          ) : (
            <button
              onClick={stopMonitoring}
              data-testid="stop-monitoring-btn"
              className="flex items-center gap-2 px-6 py-3 bg-red-500/20 text-red-400 border border-red-500/50 font-semibold rounded-xl hover:bg-red-500/30 transition-all"
            >
              <Square className="w-5 h-5" />
              Stop Monitoring
            </button>
          )}
        </motion.div>

        {/* Dashboard Grid */}
        <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6">
          {/* Webcam Feed */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="md:col-span-2 lg:col-span-2 p-6 bg-[#111111] border border-white/10 rounded-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold" style={{ fontFamily: 'Outfit, sans-serif' }}>Live Feed</h2>
              <div className="flex items-center gap-2">
                {connected ? (
                  <>
                    <Wifi className="w-4 h-4 text-green-400" />
                    <span className="text-sm text-green-400">Connected</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-400">Disconnected</span>
                  </>
                )}
              </div>
            </div>
            
            <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-white/10">
              {isMonitoring ? (
                <>
                  <video
                    ref={videoRef}
                    data-testid="webcam-video"
                    className="w-full h-full object-cover"
                    autoPlay
                    playsInline
                    muted
                  />
                  {/* Overlay corners */}
                  <div className="absolute top-4 left-4 w-8 h-8 border-l-2 border-t-2 border-blue-500"></div>
                  <div className="absolute top-4 right-4 w-8 h-8 border-r-2 border-t-2 border-blue-500"></div>
                  <div className="absolute bottom-4 left-4 w-8 h-8 border-l-2 border-b-2 border-blue-500"></div>
                  <div className="absolute bottom-4 right-4 w-8 h-8 border-r-2 border-b-2 border-blue-500"></div>
                  
                  {cameraError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                      <div className="text-center">
                        <Camera className="w-12 h-12 text-red-400 mx-auto mb-2" />
                        <p className="text-red-400">{cameraError}</p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center">
                    <Camera className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-500">Camera inactive</p>
                  </div>
                </div>
              )}
            </div>
            <canvas ref={canvasRef} className="hidden" />
          </motion.div>

          {/* Blink Counter */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="p-6 bg-[#111111] border border-white/10 rounded-2xl"
          >
            <h2 className="text-lg font-bold mb-4" style={{ fontFamily: 'Outfit, sans-serif' }}>Blinks</h2>
            <AnimatePresence mode="wait">
              <motion.div
                key={blinkCount}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.2, opacity: 0 }}
                className="text-6xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent"
                style={{ fontFamily: 'Outfit, sans-serif' }}
                data-testid="blink-counter"
              >
                {blinkCount}
              </motion.div>
            </AnimatePresence>
            <p className="text-gray-400 mt-2" style={{ fontFamily: 'Manrope, sans-serif' }}>Total detected</p>
          </motion.div>

          {/* Status */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="p-6 bg-[#111111] border border-white/10 rounded-2xl"
          >
            <h2 className="text-lg font-bold mb-4" style={{ fontFamily: 'Outfit, sans-serif' }}>Status</h2>
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-3 h-3 rounded-full ${getStatusBgColor()} ${getStatusColor()}`}>
                <div className="w-3 h-3 rounded-full animate-ping opacity-75"></div>
              </div>
              <span className={`text-2xl font-bold capitalize ${getStatusColor()}`} data-testid="status-indicator">
                {status}
              </span>
            </div>
            <div className="text-sm text-gray-400">
              <div>Rate: <span className="text-white font-semibold" data-testid="blink-rate">{blinkRate.toFixed(1)}</span> /min</div>
            </div>
          </motion.div>

          {/* Chart */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="md:col-span-3 lg:col-span-4 p-6 bg-[#111111] border border-white/10 rounded-2xl"
          >
            <h2 className="text-xl font-bold mb-6" style={{ fontFamily: 'Outfit, sans-serif' }}>Blink Rate Over Time</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis 
                    dataKey="time" 
                    stroke="#71717A"
                    style={{ fontSize: '12px', fontFamily: 'Manrope, sans-serif' }}
                  />
                  <YAxis 
                    stroke="#71717A"
                    style={{ fontSize: '12px', fontFamily: 'Manrope, sans-serif' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#111111', 
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="rate" 
                    stroke="#3B82F6" 
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorRate)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
