import { motion } from 'framer-motion';
import { SPRING_CONFIG } from '../constants';
import { PhoneFrame } from '../shared/PhoneFrame';
import { Caption } from '../shared/Caption';

const JOBS = [
  {
    name: 'Sarah K.',
    price: '$280',
    detail: 'Lawn Care · 10:00 AM',
    badge: '● Confirmed',
    badgeColor: '#22c55e',
    badgeBg: '#0d2a1a',
  },
  {
    name: 'James R.',
    price: '$350',
    detail: 'HVAC · 1:30 PM',
    badge: '⏰ In 3h',
    badgeColor: '#f59e0b',
    badgeBg: '#2a1f0d',
  },
  {
    name: 'Diana M.',
    price: '$195',
    detail: 'Pressure Wash · Wed 9am',
    badge: '📅 Tomorrow',
    badgeColor: '#3b82f6',
    badgeBg: '#0d1a2a',
  },
];

const STATS = [
  { label: 'This Week', value: '$1,240' },
  { label: 'Jobs', value: '8' },
  { label: 'Overdue', value: '$0' },
];

export function Scene2() {
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 20 / 60 }}
    >
      <PhoneFrame activeTab="Home" isEntering delay={0}>
        <div className="p-4 pt-6 bg-[#000] min-h-full">
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="text-[13px] font-bold text-white">Good morning, Marcus 👋</div>
              <div className="text-[9px] text-[#555] mt-0.5">Tuesday · 3 jobs today</div>
            </div>
            <div className="w-9 h-9 rounded-full bg-[#22c55e] flex items-center justify-center text-black text-[13px] font-bold">
              M
            </div>
          </div>

          <div className="flex gap-2 mb-5">
            {STATS.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ ...SPRING_CONFIG, delay: i * (8 / 60) }}
                className="flex-1 bg-[#111] border border-[#1e1e1e] rounded-xl p-3"
              >
                <div className="text-[13px] font-bold text-white">{stat.value}</div>
                <div className="text-[9px] text-[#555] mt-1">{stat.label}</div>
              </motion.div>
            ))}
          </div>

          <div className="text-[10px] font-bold text-[#555] tracking-wider mb-3">TODAY'S JOBS</div>

          <div className="flex flex-col gap-3">
            {JOBS.map((job, i) => (
              <motion.div
                key={job.name}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ ...SPRING_CONFIG, delay: (i + 1) * (8 / 60) }}
                className="bg-[#111] border border-[#1e1e1e] rounded-xl p-3 flex items-center justify-between"
              >
                <div>
                  <div className="text-[12px] font-bold text-white">{job.name}</div>
                  <div className="text-[9px] text-[#555] mt-0.5">{job.detail}</div>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <div className="text-[12px] font-bold text-white">{job.price}</div>
                  <div
                    className="text-[8px] font-bold px-2 py-0.5 rounded-full"
                    style={{ color: job.badgeColor, backgroundColor: job.badgeBg }}
                  >
                    {job.badge}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </PhoneFrame>

      <Caption
        eyebrow="MEET MARCUS"
        headline={'His entire business.\nOne screen.'}
        sub="Lawn care · Dallas, TX"
      />
    </motion.div>
  );
}
