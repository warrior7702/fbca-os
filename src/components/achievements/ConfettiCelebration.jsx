import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function ConfettiCelebration({ show }) {
  const [confetti, setConfetti] = useState([]);

  useEffect(() => {
    if (show) {
      // Generate 50 confetti pieces
      const pieces = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: -10,
        rotation: Math.random() * 360,
        color: ['#fbbf24', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#10b981'][Math.floor(Math.random() * 7)],
        delay: Math.random() * 0.3,
        duration: 2 + Math.random() * 1
      }));
      setConfetti(pieces);

      // Clear after animation
      setTimeout(() => setConfetti([]), 3500);
    }
  }, [show]);

  return (
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
      <AnimatePresence>
        {confetti.map((piece) => (
          <motion.div
            key={piece.id}
            initial={{
              x: `${piece.x}vw`,
              y: piece.y,
              rotate: piece.rotation,
              opacity: 1
            }}
            animate={{
              y: '110vh',
              rotate: piece.rotation + 720,
              opacity: [1, 1, 0.5, 0]
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: piece.duration,
              delay: piece.delay,
              ease: "easeIn"
            }}
            className="absolute w-3 h-3 rounded-sm"
            style={{ backgroundColor: piece.color }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}