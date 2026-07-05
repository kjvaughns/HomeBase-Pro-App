import { motion } from 'framer-motion';
import { SPRING_CONFIG } from '../constants';
import { PhoneFrame } from '../shared/PhoneFrame';
import { Caption } from '../shared/Caption';
import { useEffect, useState } from 'react';

export function Scene6() {
  const [showPaid, setShowPaid] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowPaid(true), (140 / 60) * 1000); // Frame 1440
    return () => clearTimeout(t);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 20 / 60 }}
    >
      <PhoneFrame activeTab="Messages">
        <div className="flex flex-col h-full bg-[#000] p-4 pt-8 relative">
          
          <div className="flex justify-between items-center mb-8">
            <div className="text-[12px] font-bold text-[#888]">Invoice #HB-2847</div>
            <div className="text-[12px] text-[#555]">Jul 10, 2026</div>
          </div>

          <div className="bg-[#05110a] border border-[#0d2a1a] rounded-2xl p-6 text-center mb-8">
            <div className="text-[10px] text-[#22c55e] font-bold tracking-widest mb-2">BALANCE DUE</div>
            <div className="text-[32px] font-bold text-[#22c55e] leading-none">$48.75</div>
          </div>

          <div className="flex flex-col gap-3">
            {[
              { label: "Service", val: "Lawn Care — Standard" },
              { label: "Completed", val: "Thu Jul 10, 2026" },
              { label: "Deposit paid", val: "-$16.25" },
            ].map((row, i) => (
              <motion.div
                key={i}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ ...SPRING_CONFIG, delay: i * (8/60) }}
                className="flex justify-between items-center py-2 border-b border-[#111]"
              >
                <div className="text-[12px] text-[#888]">{row.label}</div>
                <div className="text-[12px] text-white font-medium">{row.val}</div>
              </motion.div>
            ))}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ ...SPRING_CONFIG, delay: 3 * (8/60) }}
              className="flex justify-between items-center py-2 pt-4"
            >
              <div className="text-[14px] font-bold text-white">Balance</div>
              <div className="text-[14px] font-bold text-white">$48.75</div>
            </motion.div>
          </div>

          <div className="flex-1" />

          <div className="w-full bg-white text-black text-[13px] font-bold py-3.5 rounded-xl text-center mb-16 flex items-center justify-center gap-2">
            Pay $48.75 with Apple Pay 🍎
          </div>

          {/* Paid Overlay */}
          {showPaid && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-[#000]/80 backdrop-blur-md flex items-center justify-center z-50"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.2, 1] }}
                transition={SPRING_CONFIG}
                className="flex flex-col items-center"
              >
                <div className="w-[60px] h-[60px] bg-[#22c55e] rounded-full flex items-center justify-center text-black text-[24px] mb-4">
                  ✓
                </div>
                <div className="text-white font-bold text-[18px]">Paid ✓</div>
              </motion.div>
            </motion.div>
          )}

        </div>
      </PhoneFrame>

      <Caption 
        eyebrow="GET PAID INSTANTLY"
        headline={'Invoice sent.\nTwo taps.\nMoney moved.'}
        sub="Stripe · Apple Pay · 256-bit encrypted"
      />
    </motion.div>
  );
}