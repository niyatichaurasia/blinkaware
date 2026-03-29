import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Eye, ArrowLeft, Calendar, Activity, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

axios.defaults.withCredentials = true;

export function AnalyticsPage() {
  const [sessions, setSessions] = useState([]);
  const [dailyStats, setDailyStats] = useState(null);
  const [weeklyStats, setWeeklyStats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const [sessionsRes, dailyRes, weeklyRes] = await Promise.all([
        axios.get(`${API}/analytics/sessions?limit=10`),
        axios.get(`${API}/analytics/daily`),
        axios.get(`${API}/analytics/weekly`)
      ]);
      
      setSessions(sessionsRes.data);
      setDailyStats(dailyRes.data);
      setWeeklyStats(weeklyRes.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (start, end) => {
    const startTime = new Date(start);
    const endTime = end ? new Date(end) : new Date();
    const minutes = Math.floor((endTime - startTime) / 1000 / 60);
    return `${minutes} min`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-white text-xl">Loading analytics...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-black/60 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/dashboard"
              data-testid="back-to-dashboard-btn"
              className="p-2 hover:bg-white/10 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                <Eye className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold" style={{ fontFamily: 'Outfit, sans-serif' }}>Analytics</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Daily Stats Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 bg-[#111111] border border-white/10 rounded-2xl"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <Activity className="w-5 h-5 text-blue-400" />
              </div>
              <h3 className="text-lg font-bold" style={{ fontFamily: 'Outfit, sans-serif' }}>Today's Sessions</h3>
            </div>
            <div className="text-4xl font-bold" style={{ fontFamily: 'Outfit, sans-serif' }} data-testid="daily-sessions">
              {dailyStats?.total_sessions || 0}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-6 bg-[#111111] border border-white/10 rounded-2xl"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <Eye className="w-5 h-5 text-purple-400" />
              </div>
              <h3 className="text-lg font-bold" style={{ fontFamily: 'Outfit, sans-serif' }}>Total Blinks</h3>
            </div>
            <div className="text-4xl font-bold" style={{ fontFamily: 'Outfit, sans-serif' }} data-testid="daily-blinks">
              {dailyStats?.total_blinks || 0}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-6 bg-[#111111] border border-white/10 rounded-2xl"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-green-400" />
              </div>
              <h3 className="text-lg font-bold" style={{ fontFamily: 'Outfit, sans-serif' }}>Avg Blink Rate</h3>
            </div>
            <div className="text-4xl font-bold" style={{ fontFamily: 'Outfit, sans-serif' }} data-testid="daily-avg-rate">
              {dailyStats?.avg_blink_rate?.toFixed(1) || '0.0'}
              <span className="text-xl text-gray-400">/min</span>
            </div>
          </motion.div>
        </div>

        {/* Weekly Trend Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="p-6 bg-[#111111] border border-white/10 rounded-2xl mb-8"
        >
          <h2 className="text-2xl font-bold mb-6" style={{ fontFamily: 'Outfit, sans-serif' }}>Weekly Trend</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis 
                  dataKey="date" 
                  stroke="#71717A"
                  tickFormatter={formatDate}
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
                  labelFormatter={formatDate}
                />
                <Bar dataKey="blinks" fill="#3B82F6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Session History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="p-6 bg-[#111111] border border-white/10 rounded-2xl"
        >
          <h2 className="text-2xl font-bold mb-6" style={{ fontFamily: 'Outfit, sans-serif' }}>Recent Sessions</h2>
          
          {sessions.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No sessions yet. Start monitoring to see your history!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sessions.map((session, idx) => (
                <div
                  key={session.id || idx}
                  data-testid={`session-item-${idx}`}
                  className="p-4 bg-black/30 border border-white/10 rounded-xl hover:border-white/20 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm text-gray-400">
                          {formatDate(session.start_time)} at {formatTime(session.start_time)}
                        </span>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          session.status === 'completed' 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {session.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-6 text-sm">
                        <div>
                          <span className="text-gray-400">Duration: </span>
                          <span className="text-white font-semibold">
                            {formatDuration(session.start_time, session.end_time)}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400">Blinks: </span>
                          <span className="text-white font-semibold">{session.total_blinks}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Avg Rate: </span>
                          <span className="text-white font-semibold">{session.avg_blink_rate?.toFixed(1) || '0.0'}/min</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}