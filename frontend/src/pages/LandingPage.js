import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, Activity, TrendingUp, Shield } from 'lucide-react';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-hidden">
      {/* Hero Section */}
      <div className="relative min-h-screen flex items-center justify-center">
        {/* Background Image with Overlay */}
        <div 
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: 'url(https://images.pexels.com/photos/7135037/pexels-photo-7135037.jpeg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          <div className="absolute inset-0 bg-black/85"></div>
          <div className="absolute inset-0 bg-gradient-to-b from-blue-500/10 via-transparent to-purple-600/10"></div>
        </div>

        {/* Header */}
        <header className="absolute top-0 left-0 right-0 z-20 backdrop-blur-xl bg-black/60 border-b border-white/10">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                <Eye className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold" style={{ fontFamily: 'Outfit, sans-serif' }}>BlinkAware</span>
            </div>
            <Link
              to="/login"
              data-testid="header-login-btn"
              className="px-6 py-2 bg-white text-black font-medium rounded-full hover:bg-gray-200 transition-all"
            >
              Sign In
            </Link>
          </div>
        </header>

        {/* Hero Content */}
        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 
              className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 tracking-tight"
              style={{ fontFamily: 'Outfit, sans-serif' }}
            >
              Protect Your Eyes,
              <br />
              <span className="bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
                One Blink at a Time
              </span>
            </h1>
            <p className="text-lg text-gray-400 mb-8 max-w-2xl mx-auto" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Real-time AI-powered blink detection to prevent eye strain and drowsiness.
              Monitor your eye health with advanced deep learning technology.
            </p>
            <Link
              to="/register"
              data-testid="hero-cta-btn"
              className="inline-block px-10 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-lg font-semibold rounded-full hover:shadow-2xl hover:shadow-blue-500/50 transition-all transform hover:scale-105"
            >
              Start Monitoring
            </Link>
          </motion.div>
        </div>

        {/* Scroll Indicator */}
        <motion.div
          className="absolute bottom-10 left-1/2 transform -translate-x-1/2"
          animate={{ y: [0, 10, 0] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
        >
          <div className="w-6 h-10 border-2 border-white/30 rounded-full flex justify-center pt-2">
            <div className="w-1 h-2 bg-white/50 rounded-full"></div>
          </div>
        </motion.div>
      </div>

      {/* Features Section */}
      <div className="relative z-10 py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.h2 
            className="text-4xl font-bold text-center mb-16"
            style={{ fontFamily: 'Outfit, sans-serif' }}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            Why BlinkAware?
          </motion.h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Activity,
                title: "Real-Time Detection",
                description: "Advanced PyTorch-based ML model processes your blinks in real-time with <100ms latency."
              },
              {
                icon: TrendingUp,
                title: "Smart Analytics",
                description: "Track your eye health over time with detailed session history and blink rate trends."
              },
              {
                icon: Shield,
                title: "Intelligent Alerts",
                description: "Get notified when your blink rate is low or when drowsiness is detected."
              }
            ].map((feature, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.2 }}
                className="p-8 bg-[#111111] border border-white/10 rounded-2xl hover:border-white/20 hover:-translate-y-1 transition-all"
              >
                <div className="w-14 h-14 rounded-xl bg-gradient-to-r from-blue-500/20 to-purple-600/20 flex items-center justify-center mb-6">
                  <feature.icon className="w-7 h-7 text-blue-400" />
                </div>
                <h3 className="text-xl font-bold mb-3" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  {feature.title}
                </h3>
                <p className="text-gray-400" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="relative z-10 py-24 px-6">
        <motion.div
          className="max-w-4xl mx-auto text-center p-12 bg-gradient-to-r from-blue-500/10 to-purple-600/10 border border-white/10 rounded-3xl backdrop-blur-xl"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl font-bold mb-6" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Ready to protect your eyes?
          </h2>
          <p className="text-gray-400 mb-8 text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Join thousands monitoring their eye health with BlinkAware
          </p>
          <Link
            to="/register"
            data-testid="cta-register-btn"
            className="inline-block px-10 py-4 bg-white text-black text-lg font-semibold rounded-full hover:bg-gray-200 transition-all"
          >
            Get Started Free
          </Link>
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 py-8">
        <div className="max-w-6xl mx-auto px-6 text-center text-gray-500">
          <p style={{ fontFamily: 'Manrope, sans-serif' }}>© 2026 BlinkAware. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}