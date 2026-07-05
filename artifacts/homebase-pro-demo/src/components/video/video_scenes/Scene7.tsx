import { motion } from 'framer-motion';
import { SPRING_CONFIG } from '../constants';
import { PhoneFrame } from '../shared/PhoneFrame';
import { Caption } from '../shared/Caption';
import { Toast } from '../shared/Toast';

export function Scene7() {
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 20 / 60 }}
    >
      <Toast icon="⚡" title="Payout Sent" body="$1,885.00 → Chase ••4821 · ~30 min" delay={80 / 60} />

      <PhoneFrame activeTab="Money" isEntering={false}>
        <div className="p-4 pt-6 bg-[#000] min-h-full">
          <div className="text-[18px] font-bold text-white mb-6">Money</div>

          <div className="flex gap-2 mb-6">
            {[
              { label: "Available", val: "$1,885" },
              { label: "This Month", val: "$6,240" },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ ...SPRING_CONFIG, delay: i * (8/60) }}
                className="flex-1 bg-[#111] border border-[#1e1e1e] rounded-xl p-3"
              >
                <div className="text-[14px] font-bold text-white">{stat.val}</div>
                <div className="text-[10px] text-[#555] mt-1">{stat.label}</div>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ ...SPRING_CONFIG, delay: 16/60 }}
            className="bg-[#0d2a1a] border border-[#1a3a1a] rounded-2xl p-5 mb-8 flex flex-col items-center"
          >
            <div className="text-[10px] font-bold text-[#22c55e] tracking-wider mb-2">READY TO WITHDRAW</div>
            <div className="text-[32px] font-bold text-[#22c55e] mb-5 leading-none">$1,885.00</div>
            <div className="w-full bg-[#22c55e] text-black text-[12px] font-bold py-3 rounded-xl text-center mb-3">
              Instant Payout → Bank
            </div>
            <div className="text-[10px] text-[#22c55e]/60">Arrives in ~30 min</div>
          </motion.div>

          <div className="text-[12px] font-bold text-white mb-4">Recent Payouts</div>

          <div className="flex flex-col gap-3">
            {[
              { date: "Jul 9", val: "+$910", stat: "✓ Deposited" },
              { date: "Jul 7", val: "+$640", stat: "✓ Deposited" },
            ].map((row, i) => (
              <motion.div
                key={i}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ ...SPRING_CONFIG, delay: 24/60 + i * (8/60) }}
                className="flex justify-between items-center py-2"
              >
                <div className="flex items-center gap-3">
                  <div className="w-[36px] h-[36px] rounded-full bg-[#111] flex items-center justify-center text-[14px]">🏦</div>
                  <div>
                    <div className="text-[12px] font-bold text-white">Bank Payout</div>
                    <div className="text-[10px] text-[#555] mt-0.5">{row.date}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[12px] font-bold text-white">{row.val}</div>
                  <div className="text-[9px] text-[#22c55e] font-bold mt-0.5">{row.stat}</div>
                </div>
              </motion.div>
            ))}
          </div>

        </div>
      </PhoneFrame>

      <Caption 
        eyebrow="INSTANT PAYOUT"
        headline={'$1,885 hits his bank.\n30 minutes.'}
        sub="Stripe Connect · No waiting"
      />
    </motion.div>
  );
}