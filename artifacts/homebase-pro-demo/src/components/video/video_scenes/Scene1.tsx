import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { SPRING_CONFIG } from '../constants';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 0),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center bg-black text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 20 / 60 }}
    >
      <div className="flex flex-col items-center justify-center">
        <motion.div
          initial={{ y: 14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ ...SPRING_CONFIG }}
          className="text-[10px] text-[#333] tracking-[0.2em] font-bold"
        >
          EVERY HOME SERVICE PROVIDER
        </motion.div>
        
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ ...SPRING_CONFIG, delay: 0.1 }}
          className="text-[80px] font-[900] text-white leading-none my-2"
        >
          $72,000
        </motion.div>

        <motion.div
          initial={{ y: 14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ ...SPRING_CONFIG, delay: 0.2 }}
          className="text-[14px] text-[#555] mt-2"
        >
          lost every year to missed follow-ups,
        </motion.div>
        
        <motion.div
          initial={{ y: 14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ ...SPRING_CONFIG, delay: 0.3 }}
          className="text-[14px] text-[#555]"
        >
          manual invoicing, and chasing payments.
        </motion.div>
      </div>
    </motion.div>
  );
}