import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PhoneFrame } from '../shared/PhoneFrame';
import { BookingCard } from '../shared/BookingCard';

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200), // eyebrow
      setTimeout(() => setPhase(2), 600), // phone frame
      setTimeout(() => setPhase(3), 1200), // booking cards inside
      setTimeout(() => setPhase(4), 2200), // tagline
      setTimeout(() => setPhase(5), 4500), // exit
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center bg-bg text-center px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: phase >= 5 ? 0 : 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: -20 }}
        className="text-primary text-sm tracking-[0.15em] uppercase font-bold mb-8"
      >
        INTRODUCING HOMEBASE
      </motion.div>

      {phase >= 2 && (
        <PhoneFrame>
          <div className="p-5 pt-12 flex flex-col h-full">
            <div className="mb-6 text-left">
              <div className="text-white font-bold text-xl mb-1">HomeBase Pro</div>
              <div className="text-text-muted text-sm">Today's jobs</div>
            </div>

            <div className="flex-1">
              {phase >= 3 && (
                <>
                  <BookingCard
                    name="Marcus T."
                    service="Lawn care"
                    time="Tue 10am"
                    amount="$280"
                    status="Confirmed"
                    delay={0.1}
                  />
                  <BookingCard
                    name="Sarah K."
                    service="House cleaning"
                    time="Tue 2pm"
                    amount="$180"
                    status="Invoice sent"
                    delay={0.3}
                  />
                </>
              )}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ delay: 0.6 }}
              className="mt-auto border-t border-card-border pt-4 flex justify-between text-xs"
            >
              <div className="text-center">
                <div className="text-white font-bold">$460</div>
                <div className="text-text-muted">Today</div>
              </div>
              <div className="text-center">
                <div className="text-white font-bold">3</div>
                <div className="text-text-muted">Jobs</div>
              </div>
              <div className="text-center">
                <div className="text-white font-bold">$0</div>
                <div className="text-text-muted">Chasing</div>
              </div>
            </motion.div>
          </div>
        </PhoneFrame>
      )}

      <motion.div
        initial={{ opacity: 0, filter: 'blur(5px)' }}
        animate={phase >= 4 ? { opacity: 1, filter: 'blur(0px)' } : { opacity: 0, filter: 'blur(5px)' }}
        transition={{ duration: 0.8 }}
        className="text-[3vw] font-medium text-white mt-8"
      >
        Your business. <span className="text-primary">Automated.</span>
      </motion.div>
    </motion.div>
  );
}
