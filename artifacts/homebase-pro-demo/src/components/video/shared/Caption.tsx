import { motion } from 'framer-motion';
import { SPRING_CONFIG } from '../constants';

export function Caption({ 
  eyebrow, 
  headline, 
  sub 
}: { 
  eyebrow: string;
  headline: React.ReactNode;
  sub: string;
}) {
  return (
    <div className="absolute bottom-[60px] left-0 right-0 text-center z-50">
      <motion.div
        initial={{ y: 14, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...SPRING_CONFIG, delay: 0 }}
        className="text-[10px] tracking-[0.2em] text-[#22c55e] uppercase font-bold"
      >
        {eyebrow}
      </motion.div>
      <motion.div
        initial={{ y: 14, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...SPRING_CONFIG, delay: 6 / 60 }}
        className="text-[22px] font-[800] text-white leading-[1.2] mt-2 whitespace-pre-wrap"
      >
        {headline}
      </motion.div>
      <motion.div
        initial={{ y: 14, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...SPRING_CONFIG, delay: 12 / 60 }}
        className="text-[11px] text-[#555555] mt-[6px]"
      >
        {sub}
      </motion.div>
    </div>
  );
}