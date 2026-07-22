'use client';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, DollarSign, Activity } from 'lucide-react';

interface Holding {
  current_value:  number;
  total_invested: number;
  gain:           number;
  gain_pct:       number;
  day_change:     number;
}

interface Props { holdings: Holding[]; loading: boolean; }

export function PortfolioSummary({ holdings, loading }: Props) {
  const totalValue    = holdings.reduce((s, h) => s + Number(h.current_value),  0);
  const totalInvested = holdings.reduce((s, h) => s + Number(h.total_invested), 0);
  const totalGain     = holdings.reduce((s, h) => s + Number(h.gain),           0);
  const totalGainPct  = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;
  const dayChange     = holdings.reduce((s, h) => s + Number(h.day_change),     0);

  const stats = [
    {
      label:  'Portfolio Value',
      value:  `$${totalValue.toFixed(2)}`,
      sub:    `$${totalInvested.toFixed(2)} invested`,
      icon:   DollarSign,
      color:  'text-white',
    },
    {
      label:  "Today's P&L",
      value:  `${dayChange >= 0 ? '+' : ''}$${Math.abs(dayChange).toFixed(2)}`,
      sub:    'across all holdings',
      icon:   dayChange >= 0 ? TrendingUp : TrendingDown,
      color:  dayChange >= 0 ? 'text-green-400' : 'text-red-400',
    },
    {
      label:  'Total Return',
      value:  `${totalGain >= 0 ? '+' : ''}$${Math.abs(totalGain).toFixed(2)}`,
      sub:    `${totalGainPct >= 0 ? '+' : ''}${totalGainPct.toFixed(2)}% all time`,
      icon:   totalGain >= 0 ? TrendingUp : TrendingDown,
      color:  totalGain >= 0 ? 'text-green-400' : 'text-red-400',
    },
    {
      label:  'Positions',
      value:  holdings.length.toString(),
      sub:    `${holdings.filter(h => Number(h.gain) >= 0).length} winning`,
      icon:   Activity,
      color:  'text-white',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map(({ label, value, sub, icon: Icon, color }, i) => (
        <motion.div
          key={label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07 }}
          className="bg-[#111] border border-white/5 rounded-2xl p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-500 font-medium">{label}</span>
            <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
              <Icon size={14} className="text-gray-400" />
            </div>
          </div>
          {loading ? (
            <div className="space-y-2">
              <div className="h-7 bg-white/5 rounded animate-pulse w-3/4" />
              <div className="h-3 bg-white/5 rounded animate-pulse w-1/2" />
            </div>
          ) : (
            <>
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
              <div className="text-xs text-gray-500 mt-1">{sub}</div>
            </>
          )}
        </motion.div>
      ))}
    </div>
  );
}
