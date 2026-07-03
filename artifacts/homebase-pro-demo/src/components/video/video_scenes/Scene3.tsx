import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, Wrench, Package } from 'lucide-react';
import { PhoneFrame } from '../shared/PhoneFrame';
import { Cursor } from '../shared/Cursor';

export function Scene3() {
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
          <div className="text-text text-2xl font-bold mb-6">Create Invoice</div>

          <div className="bg-bg-secondary p-4 rounded-2xl mb-4">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <Wrench size={14} className="text-accent" />
                <span className="text-white text-sm">HVAC Repair</span>
              </div>
              <span className="text-white font-bold text-sm">$150.00</span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Package size={14} className="text-text-secondary" />
                <span className="text-white text-sm">Parts</span>
              </div>
              <span className="text-white font-bold text-sm">$45.00</span>
            </div>
            <div className="h-px bg-border my-3" />
            <div className="flex justify-between items-center">
              <span className="text-text-secondary text-sm font-semibold">Total</span>
              <span className="text-white font-bold text-lg">$195.00</span>
            </div>
          </div>

          <div className="flex-1" />

          <motion.div
            className="bg-accent rounded-xl py-4 flex items-center justify-center gap-2"
            style={{ borderRadius: 12 }}
            animate={phase >= 2 ? { scale: 0.95, opacity: 0.85 } : { scale: 1, opacity: 1 }}
          >
            <Send size={16} className="text-white" />
            <span className="text-white font-bold">Send Invoice</span>
          </motion.div>
        </div>
      </PhoneFrame>
      {phase >= 1 && <Cursor x="50vw" y="80vh" delay={0.2} onTap={phase >= 2} />}
    </motion.div>
  );
}