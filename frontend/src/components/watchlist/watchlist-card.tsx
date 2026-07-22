'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Star, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { authFetch } from '@/lib/api';
import { MiniSparkline } from './mini-sparkline';

interface WatchItem { ticker: string; price: number; change: number; changePct: number; }

export function WatchlistCard() {
  const router = useRouter();
  const [items,   setItems]   = useState<WatchItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch('/api/watchlist')
      .then(r => r.json())
      .then(d => setItems(Array.isArray(d) ? d.slice(0, 6) : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Star size={16} className="text-yellow-400" />
          <span className="font-semibold text-white text-sm">Watchlist</span>
        </div>
        <button onClick={() => router.push('/watchlist')}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors">
          View all <ArrowRight size={12} />
        </button>
      </div>

      {loading ? (
        <div className="p-4 space-y-3">
          {[1,2,3,4].map(i => (
            <div key={i} className="flex items-center justify-between animate-pulse">
              <div className="h-3 bg-white/5 rounded w-12" />
              <div className="h-3 bg-white/5 rounded w-20" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <Star size={28} className="text-gray-700 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">No stocks watched yet</p>
          <button onClick={() => router.push('/watchlist')}
            className="mt-2 text-xs text-green-400 hover:text-green-300 transition-colors">
            Add stocks →
          </button>
        </div>
      ) : (
        <div className="divide-y divide-white/5">
          {items.map((item, i) => {
            const up = item.changePct >= 0;
            return (
              <motion.button
                key={item.ticker}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                onClick={() => router.push(`/stock/${item.ticker}`)}
                className="flex items-center justify-between w-full px-4 py-2.5 hover:bg-white/3 transition-colors gap-3"
              >
                {/* Ticker */}
                <div className="flex items-center gap-2.5 flex-shrink-0">
                  <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
                    <span className="text-xs font-bold text-white">{item.ticker.slice(0,3)}</span>
                  </div>
                  <span className="text-sm font-semibold text-white w-12 text-left">{item.ticker}</span>
                </div>

                {/* Sparkline */}
                <div className="flex-1 flex justify-center">
                  <MiniSparkline ticker={item.ticker} isPositive={up} width={80} height={32} />
                </div>

                {/* Price + change */}
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-medium text-white">${Number(item.price).toFixed(2)}</div>
                  <div className={`flex items-center justify-end gap-0.5 text-xs font-medium ${up ? 'text-green-400' : 'text-red-400'}`}>
                    {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                    {up ? '+' : ''}{Number(item.changePct).toFixed(2)}%
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
}
