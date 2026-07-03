import { motion } from 'framer-motion';

export function PhoneFrame({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 50 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 200, damping: 20 }}
      className="relative w-[320px] h-[650px] rounded-[40px] border-[8px] border-[#111] bg-black overflow-hidden shadow-2xl z-10"
    >
      {/* Top Notch/Dynamic Island simulated */}
      <div className="absolute top-0 inset-x-0 flex justify-center z-20">
        <div className="w-[120px] h-[30px] bg-[#111] rounded-b-[20px]"></div>
      </div>
      
      <div className="w-full h-full relative z-10 bg-[#050505]">
        {children}
      </div>
      
      {/* Glow behind phone */}
      <div className="absolute inset-0 bg-accent/20 blur-[100px] -z-10 rounded-full"></div>
    </motion.div>
  );
}
