import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Eye, ArrowLeft, Save } from 'lucide-react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

axios.defaults.withCredentials = true;

export function SettingsPage() {
  const [settings, setSettings] = useState({
    alert_sensitivity: 0.7,
    break_reminder_enabled: true,
    break_interval_minutes: 20,
    sound_alerts_enabled: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data } = await axios.get(`${API}/settings`);
      setSettings(data);
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/settings`, settings);
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-white text-xl">Loading settings...</div>
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
              <span className="text-2xl font-bold" style={{ fontFamily: 'Outfit, sans-serif' }}>Settings</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Alert Sensitivity */}
          <div className="p-6 bg-[#111111] border border-white/10 rounded-2xl">
            <h3 className="text-xl font-bold mb-4" style={{ fontFamily: 'Outfit, sans-serif' }}>Alert Sensitivity</h3>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-gray-400" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    Sensitivity Level
                  </label>
                  <span className="text-white font-semibold" data-testid="sensitivity-value">
                    {(settings.alert_sensitivity * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  data-testid="sensitivity-slider"
                  min="0"
                  max="1"
                  step="0.1"
                  value={settings.alert_sensitivity}
                  onChange={(e) => handleChange('alert_sensitivity', parseFloat(e.target.value))}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer slider"
                />
                <p className="text-sm text-gray-500 mt-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  Higher sensitivity = more frequent alerts
                </p>
              </div>
            </div>
          </div>

          {/* Break Reminders */}
          <div className="p-6 bg-[#111111] border border-white/10 rounded-2xl">
            <h3 className="text-xl font-bold mb-4" style={{ fontFamily: 'Outfit, sans-serif' }}>Break Reminders</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-white font-medium" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    Enable Break Reminders
                  </label>
                  <p className="text-sm text-gray-400 mt-1">Get notified to take regular breaks</p>
                </div>
                <button
                  data-testid="break-reminder-toggle"
                  onClick={() => handleChange('break_reminder_enabled', !settings.break_reminder_enabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.break_reminder_enabled ? 'bg-blue-500' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.break_reminder_enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {settings.break_reminder_enabled && (
                <div>
                  <label className="block text-gray-400 mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    Break Interval (minutes)
                  </label>
                  <input
                    type="number"
                    data-testid="break-interval-input"
                    min="5"
                    max="60"
                    value={settings.break_interval_minutes}
                    onChange={(e) => handleChange('break_interval_minutes', parseInt(e.target.value))}
                    className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-xl text-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <p className="text-sm text-gray-500 mt-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    Follow the 20-20-20 rule: Every 20 minutes, look at something 20 feet away for 20 seconds
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Sound Alerts */}
          <div className="p-6 bg-[#111111] border border-white/10 rounded-2xl">
            <h3 className="text-xl font-bold mb-4" style={{ fontFamily: 'Outfit, sans-serif' }}>Notifications</h3>
            <div className="flex items-center justify-between">
              <div>
                <label className="text-white font-medium" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  Sound Alerts
                </label>
                <p className="text-sm text-gray-400 mt-1">Play sound for important alerts</p>
              </div>
              <button
                data-testid="sound-alerts-toggle"
                onClick={() => handleChange('sound_alerts_enabled', !settings.sound_alerts_enabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.sound_alerts_enabled ? 'bg-blue-500' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.sound_alerts_enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            data-testid="save-settings-btn"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-xl hover:shadow-xl hover:shadow-blue-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </motion.div>
      </div>
    </div>
  );
}