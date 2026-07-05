import { motion } from 'framer-motion';
import { SPRING_CONFIG } from '../constants';
import { PhoneFrame } from '../shared/PhoneFrame';

export function Scene8() {
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center bg-black"
    >
      <PhoneFrame activeTab="Money" isExiting={true}>
        <div className="bg-[#000] w-full h-full" />
      </PhoneFrame>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center z-40 bg-black" style={{ opacity: 1 }}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
          className="text-[48px] font-[300] text-white"
        >
          Run your business.
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...SPRING_CONFIG, delay: 10/60 }}
          className="text-[48px] font-[900] text-[#22c55e]"
        >
          Get clients.
        </motion.div>

        <div className="h-[60px]" />

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="flex flex-col items-center"
        >
          <div className="text-[13px] tracking-[0.15em] text-[#555] uppercase font-bold mb-2">
            HomeBase Pro
          </div>
          <div className="text-[10px] text-[#2a2a2a]">
            Available on iOS · homebaseproapp.com
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}