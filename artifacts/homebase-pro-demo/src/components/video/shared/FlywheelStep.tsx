import { motion } from 'framer-motion';

interface FlywheelStepProps {
  title: string;
  description: string;
  isLast?: boolean;
  delay?: number;
}

export function FlywheelStep({ title, description, isLast = false, delay = 0 }: FlywheelStepProps) {
  return (
    <div className="relative pl-8 mb-8 last:mb-0">
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay, type: 'spring', stiffness: 300, damping: 20 }}
        className="absolute left-[3px] top-1.5 w-3 h-3 rounded-full bg-primary z-10 shadow-[0_0_10px_rgba(34,197,94,0.5)]"
      />
      {!isLast && (
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: 'calc(100% + 2rem)' }}
          transition={{ delay: delay + 0.2, duration: 0.5, ease: 'easeOut' }}
          className="absolute left-[8px] top-4 w-[2px] bg-primary/30"
        />
      )}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: delay + 0.1, duration: 0.5 }}
      >
        <div className="text-white font-semibold text-xl mb-1">{title}</div>
        <div className="text-text-muted text-sm">{description}</div>
      </motion.div>
    </div>
  );
}
