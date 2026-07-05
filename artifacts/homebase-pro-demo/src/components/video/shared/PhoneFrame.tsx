import { motion } from 'framer-motion';
import { SPRING_CONFIG } from '../constants';
import { StatusBar } from './StatusBar';
import { BottomNav } from './BottomNav';

export function PhoneFrame({ 
  children, 
  activeTab, 
  isEntering = false,
  isExiting = false,
  delay = 0 
}: { 
  children: React.ReactNode; 
  activeTab?: string;
  isEntering?: boolean;
  isExiting?: boolean;
  delay?: number;
}) {
  return (
    <motion.div
      initial={isEntering ? { y: 80, opacity: 0 } : false}
      animate={isExiting ? { y: 100, opacity: 0 } : { y: 0, opacity: 1 }}
      transition={{ ...SPRING_CONFIG, delay: isEntering ? delay : 0 }}
      className="relative w-[340px] h-[680px] rounded-[44px] bg-[#0a0a0a] border-[1.5px] border-[#222222] shadow-[0_0_120px_rgba(0,0,0,0.9),0_0_40px_rgba(34,197,94,0.06)] overflow-hidden flex flex-col mx-auto"
    >
      {/* Top notch */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[100px] h-[24px] bg-[#000] rounded-b-[16px] z-50"></div>
      
      <StatusBar />
      
      <div className="flex-1 relative overflow-hidden bg-[#000]">
        {children}
      </div>

      {activeTab && <BottomNav activeTab={activeTab} />}
    </motion.div>
  );
}