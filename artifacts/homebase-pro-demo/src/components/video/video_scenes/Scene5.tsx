import { motion } from 'framer-motion';
import { SPRING_CONFIG } from '../constants';
import { PhoneFrame } from '../shared/PhoneFrame';
import { Caption } from '../shared/Caption';

export function Scene5() {
  const messages = [
    { in: true, text: "Confirmed for Thu Jul 10 at 10am! 🌿" },
    { in: false, text: "Gate code is 4821. Dog's friendly 😄" },
    { in: true, text: "Got it! I'll send before & after photos 📸" },
    { in: true, text: "Job complete ✅  Invoice sent — $48.75 remaining" }
  ];

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 20 / 60 }}
    >
      <PhoneFrame activeTab="Messages">
        <div className="flex flex-col h-full bg-[#000]">
          <div className="p-4 pt-6 border-b border-[#1e1e1e] flex items-center gap-3">
            <div className="text-[#555] text-[16px]">{'<'}</div>
            <div className="w-[32px] h-[32px] bg-[#0d2a1a] rounded-full flex items-center justify-center text-[16px]">🌿</div>
            <div>
              <div className="text-[14px] font-bold text-white">Marcus's Lawn Co.</div>
              <div className="text-[9px] text-[#22c55e] font-medium mt-0.5">Online now</div>
            </div>
          </div>

          <div className="flex-1 p-4 flex flex-col gap-3 justify-end pb-[80px]">
            {messages.map((m, i) => (
              <motion.div
                key={i}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ ...SPRING_CONFIG, delay: i * (12/60) }}
                className={`flex ${m.in ? 'justify-start' : 'justify-end'}`}
              >
                <div className={`max-w-[80%] rounded-[16px] px-3.5 py-2.5 text-[12px] leading-[1.4] ${m.in ? 'bg-[#151515] text-[#eee] rounded-tl-sm' : 'bg-[#22c55e] text-black font-medium rounded-tr-sm'}`}>
                  {m.text}
                </div>
              </motion.div>
            ))}
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-3 bg-[#0a0a0a] border-t border-[#1e1e1e] flex items-center gap-2">
            <div className="w-[28px] h-[28px] rounded-full bg-[#111] flex items-center justify-center text-[#555] text-[14px]">+</div>
            <div className="flex-1 h-[32px] bg-[#111] rounded-full border border-[#222] px-4 flex items-center">
              <span className="text-[11px] text-[#555]">Message...</span>
            </div>
          </div>
        </div>
      </PhoneFrame>

      <Caption 
        eyebrow="NO PHONE TAG"
        headline={'Gate code. Photos.\nInvoice. All in one thread.'}
        sub="Real-time messaging built in"
      />
    </motion.div>
  );
}