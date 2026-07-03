import { motion } from 'framer-motion';

export function Cursor({ x, y, delay, onTap }: { x: string | number, y: string | number, delay: number, onTap?: boolean }) {
  return (
    <motion.div
      initial={{ x: '100vw', y: '100vh', opacity: 0 }}
      animate={{ x, y, opacity: 1 }}
      transition={{ delay, type: 'spring', stiffness: 200, damping: 20 }}
      className="absolute z-50 pointer-events-none flex items-center justify-center"
      style={{ width: 40, height: 40, marginLeft: -20, marginTop: -20 }}
    >
      <motion.div
        animate={onTap ? { scale: [1, 0.8, 1], backgroundColor: ['rgba(255,255,255,0)', 'rgba(255,255,255,0.5)', 'rgba(255,255,255,0)'] } : {}}
        transition={{ delay: delay + 0.5, duration: 0.3 }}
        className="absolute w-12 h-12 rounded-full"
      />
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 01.35-.15h6.42c.45 0 .67-.54.35-.85L6.35 3.35a.5.5 0 00-.85.15v-.29z" fill="white" stroke="black" strokeWidth="1.5"/>
      </svg>
    </motion.div>
  );
}