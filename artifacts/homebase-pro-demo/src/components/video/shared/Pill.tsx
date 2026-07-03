import { motion } from 'framer-motion';

export function Pill({ text, delay = 0 }: { text: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, type: 'spring', stiffness: 300, damping: 25 }}
      className="px-4 py-2 rounded-full border border-pill-border bg-pill-bg text-danger text-sm font-semibold whitespace-nowrap"
    >
      {text}
    </motion.div>
  );
}
