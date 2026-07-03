import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FeatureCard } from '../shared/FeatureCard';

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300), // headline
      setTimeout(() => setPhase(2), 800), // grid
      setTimeout(() => setPhase(3), 3600), // exit
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center bg-bg px-12"
      initial={{ opacity: 0 }}
      animate={{ opacity: phase >= 3 ? 0 : 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
    >
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: -30 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="text-[4.5vw] font-bold text-white mb-12 text-center"
      >
        One app. <span className="text-primary">Zero chaos.</span>
      </motion.div>

      <div className="w-full max-w-[1000px] grid grid-cols-2 gap-6 h-[400px]">
        {phase >= 2 && (
          <>
            <FeatureCard
              title="Instant Booking"
              description="Clients book 24/7 without a single call"
              delay={0.1}
            />
            <FeatureCard
              title="Auto Follow-Up"
              description="Ghosted quotes come back on their own"
              delay={0.2}
            />
            <FeatureCard
              title="Instant Invoicing"
              description="Invoice sent the moment a job is done"
              delay={0.3}
            />
            <FeatureCard
              title="Get New Clients"
              description="Homeowners discover you in the marketplace"
              delay={0.4}
            />
          </>
        )}
      </div>
    </motion.div>
  );
}
