import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Pill } from '../shared/Pill';

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 100), // eyebrow
      setTimeout(() => setPhase(2), 600), // headline
      setTimeout(() => setPhase(3), 1400), // pills
      setTimeout(() => setPhase(4), 2600), // exit
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const headline = "Running a home service business is chaotic.";
  const words = headline.split(" ");

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center bg-bg text-center px-4"
      initial={{ opacity: 0, scale: 1.05 }}
      animate={{ opacity: phase >= 4 ? 0 : 1, scale: phase >= 4 ? 0.95 : 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.6 }}
    >
      <motion.div
        initial={{ opacity: 0, x: -50 }}
        animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -50 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="text-danger text-sm tracking-[0.15em] uppercase font-bold mb-6"
      >
        THE PROBLEM
      </motion.div>

      <div className="text-[4vw] font-bold text-white max-w-[800px] leading-tight mb-12 flex flex-wrap justify-center gap-x-[1vw]">
        {words.map((word, i) => {
          const isChaotic = word.includes("chaotic");
          return (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ delay: i * 0.1, duration: 0.4 }}
              className={isChaotic ? "text-danger" : ""}
            >
              {word}
            </motion.span>
          );
        })}
      </div>

      <div className="flex flex-wrap justify-center gap-4 max-w-[600px]">
        {phase >= 3 && (
          <>
            <Pill text="Chasing payments" delay={0.1} />
            <Pill text="Manual invoices" delay={0.2} />
            <Pill text="Ghosted quotes" delay={0.3} />
            <Pill text="No new clients" delay={0.4} />
          </>
        )}
      </div>
    </motion.div>
  );
}
