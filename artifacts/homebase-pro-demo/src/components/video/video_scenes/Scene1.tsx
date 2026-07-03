import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300), // label
      setTimeout(() => setPhase(2), 800), // number
      setTimeout(() => setPhase(3), 1600), // subtext
      setTimeout(() => setPhase(4), 2600), // exit
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center bg-bg text-center px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: phase >= 4 ? 0 : 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.6 }}
        className="text-text-muted text-sm tracking-[0.2em] uppercase font-bold mb-4"
      >
        The average home service business
      </motion.div>
      
      <motion.div
        initial={{ opacity: 0, scale: 0.5, y: 50 }}
        animate={phase >= 2 ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.5, y: 50 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="text-white text-[12vw] font-black leading-none mb-6 tracking-tighter"
      >
        $72K
      </motion.div>

      <motion.div
        initial={{ opacity: 0, filter: 'blur(10px)' }}
        animate={phase >= 3 ? { opacity: 1, filter: 'blur(0px)' } : { opacity: 0, filter: 'blur(10px)' }}
        transition={{ duration: 0.8 }}
        className="text-text-muted text-xl max-w-[600px] leading-relaxed"
      >
        Lost every year to missed follow-ups. Not to competition. <span className="text-white">To silence.</span>
      </motion.div>
    </motion.div>
  );
}
