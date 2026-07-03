import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function Scene6() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400), // eyebrow
      setTimeout(() => setPhase(2), 1000), // headline
      setTimeout(() => setPhase(3), 1800), // subtext
      setTimeout(() => setPhase(4), 2600), // app store
      setTimeout(() => setPhase(5), 3600), // logo
      setTimeout(() => setPhase(6), 8500), // exit
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center bg-bg text-center px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: phase >= 6 ? 0 : 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1 }}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={phase >= 1 ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 1 }}
        className="text-text-ultra-muted text-sm tracking-[0.2em] uppercase font-bold mb-8"
      >
        AVAILABLE ON iOS
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={phase >= 2 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="text-[5vw] font-black text-white leading-none mb-6"
      >
        Run your business. <br/>
        <span className="text-primary">Get clients.</span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.8 }}
        className="text-text-muted text-xl mb-12"
      >
        Join the home service providers already on HomeBase Pro.
      </motion.div>

      <motion.div
        initial={{ opacity: 0, filter: 'blur(10px)', y: 30 }}
        animate={phase >= 4 ? { opacity: 1, filter: 'blur(0px)', y: 0 } : { opacity: 0, filter: 'blur(10px)', y: 30 }}
        transition={{ duration: 0.8 }}
        className="mb-16"
      >
        {/* Decorative App Store badge */}
        <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-6 py-3">
          <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.62 1.54-1.45 2.97-2.53 4.08zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.36 2.38-2.04 4.38-3.74 4.25z"/>
          </svg>
          <div className="text-left">
            <div className="text-[10px] text-white/60 leading-none mb-1">Download on the</div>
            <div className="text-xl font-semibold text-white leading-none">App Store</div>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={phase >= 5 ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 1.5 }}
        className="text-text-ultra-muted text-xs tracking-[0.3em] font-bold"
      >
        HOMEBASE PRO APP
      </motion.div>
    </motion.div>
  );
}
