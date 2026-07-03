import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PhoneFrame } from '../shared/PhoneFrame';

export function Scene6() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center bg-bg-root"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <PhoneFrame>
        <div className="flex-1 bg-bg-default p-4 pt-12 relative">
          
          <motion.div 
            className="absolute inset-0 bg-accent z-50 flex items-center justify-center flex-col"
            initial={{ y: '100%' }}
            animate={{ y: phase >= 1 ? 0 : '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          >
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <div className="text-white text-2xl font-bold">Paid</div>
          </motion.div>

        </div>
      </PhoneFrame>
      
      {phase >= 2 && (
        <motion.div
          className="absolute inset-0 bg-bg-root z-50 flex flex-col items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.img
            src={`${import.meta.env.BASE_URL}images/homebase-logo.png`}
            alt="HomeBase Pro"
            className="w-[10vw] h-[10vw] object-contain mb-4"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 240, damping: 20 }}
          />
          <div className="text-white text-[2.6vw] font-bold tracking-tight mb-2">HomeBase Pro</div>
          <div className="text-text-secondary text-[1.1vw]">Get paid instantly.</div>
        </motion.div>
      )}
    </motion.div>
  );
}