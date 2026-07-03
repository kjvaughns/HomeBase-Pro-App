import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Wrench, User, Check } from 'lucide-react';
import { PhoneFrame } from '../shared/PhoneFrame';
import { Cursor } from '../shared/Cursor';

export function Scene2() {
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
        <div className="flex-1 bg-bg-default p-4 pt-12 flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <Wrench size={14} className="text-accent" />
            <div className="text-text-secondary text-xs font-semibold uppercase tracking-wide">In Progress</div>
          </div>
          <div className="text-text text-2xl font-bold mb-6">HVAC Repair</div>

          <div className="bg-bg-secondary p-4 rounded-2xl mb-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-bg-tertiary flex items-center justify-center">
              <User size={16} className="text-text-secondary" />
            </div>
            <div>
              <div className="text-white font-semibold text-sm">John Smith</div>
              <div className="text-text-secondary text-xs">Client</div>
            </div>
          </div>

          <div className="flex-1" />

          <motion.div
            className="bg-accent rounded-xl py-4 flex items-center justify-center gap-2"
            style={{ borderRadius: 12 }}
            animate={phase >= 2 ? { scale: 0.95, opacity: 0.85 } : { scale: 1, opacity: 1 }}
          >
            <Check size={16} className="text-white" />
            <span className="text-white font-bold">Complete Job</span>
          </motion.div>
        </div>
      </PhoneFrame>
      {phase >= 1 && <Cursor x="50vw" y="70vh" delay={0.2} onTap={phase >= 2} />}
    </motion.div>
  );
}