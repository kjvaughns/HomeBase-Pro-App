import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FlywheelStep } from '../shared/FlywheelStep';

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200), // eyebrow
      setTimeout(() => setPhase(2), 600), // headline pt 1
      setTimeout(() => setPhase(3), 1400), // headline pt 2
      setTimeout(() => setPhase(4), 2200), // step 1
      setTimeout(() => setPhase(5), 2800), // step 2
      setTimeout(() => setPhase(6), 3400), // step 3
      setTimeout(() => setPhase(7), 4000), // step 4
      setTimeout(() => setPhase(8), 5600), // exit
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center bg-bg px-[10vw]"
      initial={{ opacity: 0 }}
      animate={{ opacity: phase >= 8 ? 0 : 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="w-1/2 pr-12 flex flex-col justify-center">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 }}
          className="text-primary text-sm tracking-[0.15em] uppercase font-bold mb-6"
        >
          THE FLYWHEEL
        </motion.div>

        <div className="text-[3vw] font-bold leading-tight">
          <motion.span
            initial={{ opacity: 0 }}
            animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
            className="text-white block mb-4"
          >
            Every other app helps you manage clients you have.
          </motion.span>
          <motion.span
            initial={{ opacity: 0, filter: 'blur(10px)' }}
            animate={phase >= 3 ? { opacity: 1, filter: 'blur(0px)' } : { opacity: 0, filter: 'blur(10px)' }}
            className="text-primary block"
          >
            HomeBase gets you new ones.
          </motion.span>
        </div>
      </div>

      <div className="w-1/2 pl-12 flex flex-col justify-center py-12">
        {phase >= 4 && (
          <FlywheelStep 
            title="Providers join with existing clients" 
            description="They bring their book. The flywheel starts." 
            delay={0}
          />
        )}
        {phase >= 5 && (
          <FlywheelStep 
            title="Homeowners discover other services" 
            description="Lawn care client finds a cleaner." 
            delay={0}
          />
        )}
        {phase >= 6 && (
          <FlywheelStep 
            title="Demand pulls in new providers" 
            description="More homeowners. More categories." 
            delay={0}
          />
        )}
        {phase >= 7 && (
          <FlywheelStep 
            title="The marketplace compounds" 
            description="No competitor can replicate this moat." 
            isLast={true}
            delay={0}
          />
        )}
      </div>
    </motion.div>
  );
}
