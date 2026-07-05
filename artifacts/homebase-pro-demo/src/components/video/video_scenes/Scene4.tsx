import { motion } from 'framer-motion';
import { SPRING_CONFIG } from '../constants';
import { PhoneFrame } from '../shared/PhoneFrame';
import { Caption } from '../shared/Caption';
import { Toast } from '../shared/Toast';

export function Scene4() {
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 20 / 60 }}
    >
      <Toast icon="🎉" title="Booking Confirmed!" body="Marcus's Lawn Co. · Jul 10 · 10:00 AM" delay={220 / 60} />
      
      <PhoneFrame activeTab="Explore">
        <div className="flex flex-col h-full bg-[#000]">
          <div className="p-4 pt-6 border-b border-[#1e1e1e]">
            <div className="text-[12px] text-[#555] mb-1">Book</div>
            <div className="text-[16px] font-bold text-white flex items-center gap-2">
              <span className="w-[20px] h-[20px] bg-[#0d2a1a] rounded-full flex items-center justify-center text-[10px]">🌿</span>
              Marcus's Lawn Co.
            </div>
          </div>

          <div className="p-4">
            <div className="flex justify-between items-center mb-4">
              <div className="text-[14px] font-bold text-white">July 2026</div>
              <div className="flex gap-2">
                <div className="w-[24px] h-[24px] rounded bg-[#111] flex items-center justify-center text-[#555] text-[10px]">{'<'}</div>
                <div className="w-[24px] h-[24px] rounded bg-[#111] flex items-center justify-center text-[#fff] text-[10px]">{'>'}</div>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center mb-2">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <div key={i} className="text-[10px] text-[#555] font-bold">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 text-center mb-6">
              {Array.from({ length: 14 }).map((_, i) => {
                const day = i + 1;
                const isSelected = day === 10;
                return (
                  <div key={day} className="flex justify-center py-1">
                    {isSelected ? (
                      <motion.div
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={SPRING_CONFIG}
                        className="w-[26px] h-[26px] rounded-full bg-[#22c55e] text-black font-bold flex items-center justify-center text-[12px]"
                      >
                        {day}
                      </motion.div>
                    ) : (
                      <div className="w-[26px] h-[26px] rounded-full flex items-center justify-center text-[12px] text-[#aaa]">
                        {day}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="text-[12px] font-bold text-white mb-3">Available Times</div>
            <div className="flex gap-2 overflow-hidden">
              <div className="bg-[#0d2a1a] border border-[#22c55e] text-[#22c55e] px-4 py-2 rounded-lg text-[12px] font-bold whitespace-nowrap">
                10:00 AM
              </div>
              <div className="bg-[#111] border border-[#1e1e1e] text-[#aaa] px-4 py-2 rounded-lg text-[12px] font-medium whitespace-nowrap">
                1:30 PM
              </div>
              <div className="bg-[#111] border border-[#1e1e1e] text-[#aaa] px-4 py-2 rounded-lg text-[12px] font-medium whitespace-nowrap">
                3:00 PM
              </div>
            </div>
          </div>

          <div className="flex-1" />

          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            transition={{ ...SPRING_CONFIG, delay: 0.5 }}
            className="bg-[#111] border-t border-[#1e1e1e] p-4 pb-6"
          >
            <div className="text-[12px] font-bold text-white mb-1">Lawn Care — Standard</div>
            <div className="text-[10px] text-[#888] mb-4">Thu Jul 10 · 10:00 AM · ~1.5h</div>
            
            <div className="flex justify-between items-center mb-4">
              <div className="text-[12px] font-medium text-white">Deposit (25%)</div>
              <div className="text-[12px] font-bold text-[#f59e0b]">$16.25 due now</div>
            </div>

            <motion.div
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              className="w-full bg-[#22c55e] text-black text-[12px] font-bold py-3.5 rounded-xl text-center"
            >
              Confirm & Pay Deposit →
            </motion.div>
          </motion.div>
        </div>
      </PhoneFrame>

      <Caption 
        eyebrow="INSTANT BOOKING"
        headline={'Pick a time.\nDeposit captured.\nDone.'}
        sub="No calls. No back-and-forth."
      />
    </motion.div>
  );
}