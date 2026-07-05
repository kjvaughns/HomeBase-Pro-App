import { motion, AnimatePresence } from 'framer-motion';
import { SPRING_CONFIG } from '../constants';
import { useEffect, useState } from 'react';

export function Toast({
  icon,
  title,
  body,
  delay = 0,
}: {
  icon: string;
  title: string;
  body: string;
  delay?: number;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), delay * 1000);
    const t2 = setTimeout(() => setVisible(false), delay * 1000 + (70 / 60) * 1000); // exit after 70 frames
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [delay]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -30, opacity: 0 }}
          transition={SPRING_CONFIG}
          className="absolute top-[30px] left-[14px] right-[14px] bg-[#111] border-[0.5px] border-[#222] rounded-[12px] p-[10px] px-[12px] flex items-center gap-3 z-50 shadow-2xl"
        >
          <div className="w-[26px] h-[26px] rounded-[7px] bg-[#0d2a1a] flex items-center justify-center text-[14px]">
            {icon}
          </div>
          <div className="flex flex-col">
            <div className="text-[10px] font-[700] text-white">{title}</div>
            <div className="text-[9px] text-[#aaa]">{body}</div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}