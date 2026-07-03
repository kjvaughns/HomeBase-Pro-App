import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 1200),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center bg-bg-root text-center px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: phase >= 2 ? 0 : 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <motion.img
        src={`${import.meta.env.BASE_URL}images/homebase-logo.png`}
        alt="HomeBase Pro"
        className="w-[14vw] h-[14vw] object-contain"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={phase >= 1 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.6 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      />
      <motion.div
        className="text-white text-[2.2vw] font-bold tracking-tight mt-4"
        initial={{ opacity: 0, y: 10 }}
        animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
        transition={{ delay: 0.15, duration: 0.4 }}
      >
        HomeBase Pro
      </motion.div>
    </motion.div>
  );
}