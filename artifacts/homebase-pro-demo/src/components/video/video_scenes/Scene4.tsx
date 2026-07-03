import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, DollarSign } from 'lucide-react';
import { PhoneFrame } from '../shared/PhoneFrame';
import { Cursor } from '../shared/Cursor';

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 2000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center bg-bg-root"
      initial={{ opacity: 0 }}
      animate={{ opacity: phase >= 3 ? 0 : 1 }}
      exit={{ opacity: 0 }}
    >
      <PhoneFrame>
        <div className="flex-1 bg-bg-default p-4 pt-12">
          <div className="text-center mb-6">
            <div className="text-text-secondary text-sm font-semibold mb-2">Invoice #INV-001</div>
            <div className="text-text text-4xl font-bold">$195.00</div>
            <div className="inline-flex items-center gap-1 bg-info/20 text-info px-3 py-1 rounded-full text-xs font-bold mt-2">
              <Send size={11} />
              Sent
            </div>
          </div>

          <div className="flex-1" />

          <motion.div
            className="bg-bg-secondary rounded-xl py-4 flex items-center justify-center gap-2"
            style={{ borderRadius: 12 }}
            animate={phase >= 2 ? { scale: 0.95, opacity: 0.8 } : { scale: 1, opacity: 1 }}
          >
            <DollarSign size={16} className="text-white" />
            <span className="text-white font-bold">Record Payment</span>
          </motion.div>
        </div>
      </PhoneFrame>
      {phase >= 1 && <Cursor x="50vw" y="80vh" delay={0.2} onTap={phase >= 2} />}
    </motion.div>
  );
}