
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Layers, Zap, Shield, Globe } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function Loading() {
  const navigate = useNavigate();
  const [loadingStage, setLoadingStage] = useState(0);
  const [progress, setProgress] = useState(0);
  const [showClickPrompt, setShowClickPrompt] = useState(false);

  const stages = [
    { icon: Shield, text: "Authenticating...", color: "text-blue-500" },
    { icon: Layers, text: "Loading modules...", color: "text-purple-500" },
    { icon: Globe, text: "Connecting services...", color: "text-green-500" },
    { icon: Zap, text: "System ready", color: "text-yellow-500" }
  ];

  useEffect(() => {
    const stageInterval = setInterval(() => {
      setLoadingStage(prev => {
        if (prev < stages.length - 1) return prev + 1;
        return prev;
      });
    }, 1500);

    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev < 100) return prev + 2;
        return prev;
      });
    }, 60);

    return () => {
      clearInterval(stageInterval);
      clearInterval(progressInterval);
    };
  }, []);

  useEffect(() => {
    if (progress >= 100) {
      setTimeout(() => {
        setShowClickPrompt(true);
      }, 500);
    }
  }, [progress]);

  const handleClick = () => {
    if (progress >= 100) {
      navigate(createPageUrl("Dashboard"));
    }
  };

  const CurrentIcon = stages[loadingStage].icon;

  return (
    <div 
      onClick={handleClick}
      className={`min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4 overflow-hidden ${
        progress >= 100 ? 'cursor-pointer' : ''
      }`}
    >
      <style>{`
        .fbca-logo-loading {
          filter: drop-shadow(0 4px 20px rgba(59, 130, 246, 0.6))
                  drop-shadow(0 0 40px rgba(59, 130, 246, 0.4));
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        .pulse-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }
      `}</style>

      {/* Animated background grid */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px'
        }} />
      </div>

      {/* Glowing orbs */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="absolute top-20 left-20 w-96 h-96 bg-blue-500 rounded-full blur-3xl"
      />
      <motion.div
        animate={{
          scale: [1.2, 1, 1.2],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2
        }}
        className="absolute bottom-20 right-20 w-96 h-96 bg-purple-500 rounded-full blur-3xl"
      />

      <div className="relative z-10 text-center">
        {/* Logo */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{
            type: "spring",
            stiffness: 200,
            damping: 20
          }}
          className="mb-8"
        >
          <div className="relative inline-block">
            {/* Rotating outer ring */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: "linear"
              }}
              className="absolute inset-0 -m-4"
            >
              <div className="w-32 h-32 border-4 border-blue-500 border-t-transparent border-l-transparent rounded-full" />
            </motion.div>

            {/* Logo container */}
            <div className="relative w-24 h-24 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center shadow-2xl p-3">
              <img 
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68fb9a0b2d7d369a37662cca/0bf40efc2_FBCA_AppIcon_Ryl_web.png"
                alt="FBCA Logo"
                className="w-full h-full object-contain fbca-logo-loading"
              />
            </div>

            {/* Pulsing glow */}
            <motion.div
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.5, 0, 0.5],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="absolute inset-0 -m-2 bg-blue-500 rounded-2xl blur-xl"
            />
          </div>
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h1 className="text-5xl font-bold text-white mb-2 tracking-tight">
            FBCA <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">OS</span>
          </h1>
          <p className="text-gray-400 text-sm tracking-widest uppercase">Operating System v1.0</p>
        </motion.div>

        {/* Loading status */}
        <div className="mt-12 mb-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={loadingStage}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="flex items-center justify-center gap-3"
            >
              <CurrentIcon className={`w-6 h-6 ${stages[loadingStage].color}`} />
              <span className="text-gray-300 text-lg font-medium">
                {stages[loadingStage].text}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Progress bar */}
        <div className="max-w-md mx-auto">
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden shadow-inner">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ ease: "easeOut" }}
              className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 rounded-full relative"
            >
              <motion.div
                animate={{
                  x: ["-100%", "200%"]
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "linear"
                }}
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30"
              />
            </motion.div>
          </div>
          <div className="mt-2 text-gray-400 text-sm font-mono">
            {progress}%
          </div>
        </div>

        {/* Tagline */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="mt-12"
        >
          <p className="text-gray-300 text-lg font-light italic">
            Everything you need, right here.
          </p>
        </motion.div>

        {/* Click to Enter Prompt */}
        <AnimatePresence>
          {showClickPrompt && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-8"
            >
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="text-white/80 text-sm font-medium pulse-glow"
              >
                Click anywhere to enter →
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
