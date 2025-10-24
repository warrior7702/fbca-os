import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Layers, Zap, Shield, Globe } from "lucide-react";

export default function Loading() {
  const [loadingStage, setLoadingStage] = useState(0);
  const [progress, setProgress] = useState(0);

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

  const CurrentIcon = stages[loadingStage].icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4 overflow-hidden">
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
            <div className="relative w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-2xl">
              <div className="text-white font-bold text-3xl">
                <span className="tracking-wider">FB</span>
                <span className="text-yellow-300">44</span>
              </div>
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
            FBCA <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">OS</span>
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

        {/* Module indicators */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-12 flex items-center justify-center gap-2"
        >
          {['Marketing', 'Food Service', 'FBCA Nexts'].map((module, index) => (
            <motion.div
              key={module}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 1.2 + index * 0.2 }}
              className="px-3 py-1 bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-full text-xs text-gray-400"
            >
              {module}
            </motion.div>
          ))}
        </motion.div>

        {/* Base 44 framework badge */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          className="mt-8 text-gray-500 text-xs"
        >
          Powered by <span className="text-blue-400 font-semibold">Base 44</span> Framework
        </motion.div>
      </div>
    </div>
  );
}