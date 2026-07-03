import { motion } from 'framer-motion';

interface BookingCardProps {
  name: string;
  service: string;
  time: string;
  amount: string;
  status: string;
  delay?: number;
}

export function BookingCard({ name, service, time, amount, status, delay = 0 }: BookingCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, type: 'spring', stiffness: 300, damping: 25 }}
      className="w-full bg-card-bg border border-card-border rounded-xl p-4 mb-3"
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="text-white font-semibold text-sm">{name}</div>
          <div className="text-text-muted text-xs">{service} · {time}</div>
        </div>
        <div className="text-white font-semibold text-sm">{amount}</div>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-primary"></div>
        </div>
        <div className="text-primary text-xs font-medium">{status}</div>
      </div>
    </motion.div>
  );
}
