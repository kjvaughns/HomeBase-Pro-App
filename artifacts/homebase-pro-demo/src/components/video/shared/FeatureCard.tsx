import { motion } from 'framer-motion';

interface FeatureCardProps {
  title: string;
  description: string;
  delay?: number;
}

export function FeatureCard({ title, description, delay = 0 }: FeatureCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, type: 'spring', stiffness: 250, damping: 25 }}
      className="bg-card-bg border border-card-border rounded-xl p-6 h-full flex flex-col justify-center"
    >
      <div className="text-primary font-semibold text-lg mb-2">{title}</div>
      <div className="text-text-muted text-sm leading-relaxed">{description}</div>
    </motion.div>
  );
}
