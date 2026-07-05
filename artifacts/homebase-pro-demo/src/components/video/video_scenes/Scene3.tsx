import { motion } from 'framer-motion';
import { SPRING_CONFIG } from '../constants';
import { PhoneFrame } from '../shared/PhoneFrame';
import { Caption } from '../shared/Caption';

export function Scene3() {
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 20 / 60 }}
    >
      <PhoneFrame activeTab="Explore" isEntering={false}>
        <div className="p-4 pt-6 bg-[#000] min-h-full">
          <div className="text-[14px] font-bold text-white mb-3">Find a service</div>
          
          <div className="bg-[#111] border border-[#1e1e1e] rounded-xl px-3 py-2.5 mb-6 flex items-center gap-2">
            <span className="text-[12px]">🔍</span>
            <span className="text-[11px] text-[#555]">Lawn care near Dallas...</span>
          </div>

          <div className="text-[10px] font-bold text-[#555] tracking-wider mb-3">TOP PROVIDERS NEAR YOU</div>

          <div className="flex flex-col gap-3">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ ...SPRING_CONFIG, delay: 0 }}
              className="bg-[#111] border border-[#1e1e1e] rounded-xl p-3"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-[36px] h-[36px] rounded-full bg-[#0d2a1a] flex items-center justify-center text-[16px]">
                  🌿
                </div>
                <div className="flex-1">
                  <div className="text-[12px] font-bold text-white">Marcus's Lawn Co.</div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-[9px] text-[#f59e0b]">★★★★★</span>
                    <span className="text-[9px] text-white font-bold">4.9</span>
                    <span className="text-[9px] text-[#555]">(127)</span>
                  </div>
                </div>
                <div className="text-[12px] font-bold text-white">$65<span className="text-[9px] text-[#555] font-normal">/visit</span></div>
              </div>
              
              <div className="flex gap-1 mb-3">
                {['Lawn Care', 'Edging', 'Cleanup'].map((tag) => (
                  <div key={tag} className="bg-[#222] text-[#aaa] text-[8px] px-2 py-1 rounded">
                    {tag}
                  </div>
                ))}
              </div>

              <div className="w-full bg-[#22c55e] text-black text-[11px] font-bold py-2.5 rounded-lg text-center">
                Book Now
              </div>
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ ...SPRING_CONFIG, delay: 10/60 }}
              className="bg-[#111] border border-[#1e1e1e] rounded-xl p-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-[36px] h-[36px] rounded-full bg-[#1a1a2e] flex items-center justify-center text-[16px]">
                  🏠
                </div>
                <div className="flex-1">
                  <div className="text-[12px] font-bold text-white">ProClean Services</div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-[9px] text-[#f59e0b]">★★★★☆</span>
                    <span className="text-[9px] text-white font-bold">4.7</span>
                    <span className="text-[9px] text-[#555]">(89)</span>
                  </div>
                </div>
                <div className="text-[12px] font-bold text-white">$120<span className="text-[9px] text-[#555] font-normal">/visit</span></div>
              </div>
            </motion.div>
          </div>
        </div>
      </PhoneFrame>

      <Caption 
        eyebrow="THE MARKETPLACE"
        headline={'A homeowner finds Marcus\nin 30 seconds.'}
        sub="Free for homeowners · forever"
      />
    </motion.div>
  );
}