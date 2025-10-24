import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";

export default function TheLightHelper({ user }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check if user is missing any connections
    const hasPCO = !!user?.pco_access_token;
    const hasClickUp = !!user?.clickup_access_token;
    const hasMicrosoft = !!user?.microsoft_access_token;

    const missingConnections = !hasPCO || !hasClickUp || !hasMicrosoft;

    // Check if user has dismissed this session
    const dismissed = sessionStorage.getItem('lightHelperDismissed');

    if (missingConnections && !dismissed) {
      // Delay appearance for smooth entrance
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [user]);

  const handleDismiss = () => {
    setIsDismissed(true);
    setIsVisible(false);
    sessionStorage.setItem('lightHelperDismissed', 'true');
  };

  return (
    <AnimatePresence>
      {isVisible && !isDismissed && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.8 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="fixed bottom-24 right-6 z-50"
        >
          <div className="relative">
            {/* The Light Character */}
            <motion.div
              animate={{
                y: [0, -8, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="absolute -top-16 right-4"
            >
              <div className="relative">
                {/* Glow effect */}
                <motion.div
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.5, 0.8, 0.5],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="absolute inset-0 bg-yellow-400 rounded-full blur-xl"
                />
                {/* Light bulb character */}
                <div className="relative w-12 h-12 bg-gradient-to-br from-yellow-300 to-yellow-500 rounded-full flex items-center justify-center shadow-2xl">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
              </div>
            </motion.div>

            {/* Message bubble */}
            <div className="bg-white rounded-2xl shadow-2xl border-2 border-yellow-400 p-4 max-w-sm relative">
              {/* Close button */}
              <button
                onClick={handleDismiss}
                className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>

              {/* Character name */}
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                <span className="text-xs font-semibold text-yellow-600 uppercase tracking-wide">
                  The Light
                </span>
              </div>

              {/* Message */}
              <p className="text-slate-700 text-sm mb-4 leading-relaxed">
                It looks like one or more of your accounts are not connected. 
                Let me help you get everything set up!
              </p>

              {/* Action button */}
              <Link to={createPageUrl("Settings") + "?tab=integrations"}>
                <Button 
                  onClick={handleDismiss}
                  className="w-full bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-slate-900 font-medium shadow-lg"
                >
                  Connect Accounts
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>

              {/* Dismiss link */}
              <button
                onClick={handleDismiss}
                className="w-full mt-2 text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                I'll do this later
              </button>

              {/* Speech bubble tail */}
              <div className="absolute -top-3 right-8 w-6 h-6 bg-white border-l-2 border-t-2 border-yellow-400 transform rotate-45" />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}