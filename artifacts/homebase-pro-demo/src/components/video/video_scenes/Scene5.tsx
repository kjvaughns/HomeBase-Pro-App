import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, Edit3, Check } from 'lucide-react';
import { PhoneFrame } from '../shared/PhoneFrame';
import { Cursor } from '../shared/Cursor';

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 2500),
      setTimeout(() => setPhase(4), 3000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center bg-bg-root"
      initial={{ opacity: 0 }}
      animate={{ opacity: phase >= 4 ? 0 : 1 }}
      exit={{ opacity: 0 }}
    >
      <PhoneFrame>
        <div className="flex-1 bg-bg-default p-4 pt-12 flex flex-col justify-end">
          <motion.div className="bg-bg-secondary rounded-t-3xl p-6 pb-12 -mx-4 -mb-4 shadow-2xl border-t border-border">
            <div className="text-white font-bold text-xl mb-4">Record Payment</div>

            <div className="text-text-secondary text-xs font-semibold uppercase tracking-wide mb-2">Method</div>
            <div className="flex gap-2 mb-6">
              <div
                className="flex-1 bg-accent-light border border-accent flex items-center justify-center gap-1.5 py-3"
                style={{ borderRadius: 12 }}
              >
                <DollarSign size={14} className="text-accent" />
                <span className="text-accent font-semibold text-sm">Cash</span>
              </div>
              <div
                className="flex-1 bg-bg-tertiary flex items-center justify-center gap-1.5 py-3"
                style={{ borderRadius: 12 }}
              >
                <Edit3 size={14} className="text-white" />
                <span className="text-white font-semibold text-sm">Check</span>
              </div>
            </div>

            <motion.div
              className="bg-accent flex items-center justify-center gap-2 py-4"
              style={{ borderRadius: 12 }}
              animate={phase >= 2 ? { scale: 0.95, opacity: 0.8 } : { scale: 1, opacity: 1 }}
            >
              <Check size={16} className="text-white" />
              <span className="text-white font-bold">Confirm $195.00</span>
            </motion.div>
          </motion.div>
        </div>
      </PhoneFrame>
      {phase >= 1 && <Cursor x="50vw" y="80vh" delay={0.2} onTap={phase >= 2} />}
    </motion.div>
  );
}