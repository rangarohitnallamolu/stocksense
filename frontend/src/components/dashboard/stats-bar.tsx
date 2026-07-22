'use client';
import { TrendingUp, TrendingDown, Bot, Activity } from 'lucide-react';
import { motion } from 'framer-motion';

const stats = [
  { label: 'Portfolio Value',  value: '$0.00',  change: '+0.00%', up: true,  icon: TrendingUp },
  { label: 'Today\'s P&L',    value: '$0.00',  change: '+$0.00', up: true,  icon: Activity },
  { label: 'AI Strong Buys',  value: '—',      change: 'updated 6h', up: true, icon: Bot },
  { label: 'Watchlist Alerts',value: '0',      change: 'no alerts', up: true, icon: TrendingDown },
];

export function StatsBar() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map(({ label, value, change, up, icon: Icon }, i) => (
        <motion.div
          key={label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07 }}
          className="bg-[#111] border border-white/5 rounded-2xl p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-500 font-medium">{label}</span>
            <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
              <Icon size={14} className="text-gray-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white mb-1">{value}</div>
          <div className={`text-xs font-medium ${up ? 'text-green-400' : 'text-red-400'}`}>{change}</div>
        </motion.div>
      ))}
    </div>
  );
}
