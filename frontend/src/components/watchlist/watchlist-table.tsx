'use client';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Trash2, ExternalLink } from 'lucide-react';
import { authFetch } from '@/lib/api';
import { MiniSparkline } from './mini-sparkline';

interface WatchItem {
  ticker:    string;
  price:     number;
  change:    number;
  changePct: number;
  high:      number;
  low:       number;
  prevClose: number;
  added_at:  string;
}

interface Props { items: WatchItem[]; onRemoved: (ticker: string) => void; }

export function WatchlistTable({ items, onRemoved }: Props) {
  const router = useRouter();

  async function remove(ticker: string) {
    await authFetch(`/api/watchlist/${ticker}`, { method: 'DELETE' });
    onRemoved(ticker);
  }

  if (!items.length) {
    return (
      <div className="bg-[#111] border border-white/5 rounded-2xl p-12 text-center">
        <div className="text-4xl mb-3">⭐</div>
        <p className="text-white font-medium mb-1">Watchlist is empty</p>
        <p className="text-gray-500 text-sm">Search for a stock and click "Watchlist" to add it</p>
      </div>
    );
  }

  return (
    <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-12 gap-2 px-5 py-3 border-b border-white/5 text-xs font-medium text-gray-500 uppercase tracking-wide">
        <div className="col-span-3">Stock</div>
        <div className="col-span-2 text-right">Price</div>
        <div className="col-span-2 text-right">Change</div>
        <div className="col-span-3 text-right">Intraday</div>
        <div className="col-span-2 text-right">Actions</div>
      </div>

      {items.map((item, i) => {
        const up = item.changePct >= 0;
        return (
          <motion.div
            key={item.ticker}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="grid grid-cols-12 gap-2 px-5 py-3 border-b border-white/5 last:border-0 hover:bg-white/2 transition-colors group items-center"
          >
            {/* Stock */}
            <div className="col-span-3">
              <div className="font-semibold text-white">{item.ticker}</div>
              <div className="text-xs text-gray-500 mt-0.5">
                Prev close ${item.prevClose.toFixed(2)}
              </div>
            </div>

            {/* Price */}
            <div className="col-span-2 text-right">
              <div className="text-sm font-semibold text-white">${item.price.toFixed(2)}</div>
            </div>

            {/* Change */}
            <div className="col-span-2 text-right">
              <div className={`flex items-center justify-end gap-1 text-sm font-medium ${up ? 'text-green-400' : 'text-red-400'}`}>
                {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {up ? '+' : ''}{item.change.toFixed(2)}
              </div>
              <div className={`text-xs ${up ? 'text-green-400' : 'text-red-400'}`}>
                {up ? '+' : ''}{item.changePct.toFixed(2)}%
              </div>
            </div>

            {/* Intraday sparkline + H/L */}
            <div className="col-span-3 flex items-center justify-end gap-2">
              <div className="text-right flex-shrink-0">
                <div className="text-xs text-green-400 font-medium leading-tight">H ${item.high.toFixed(2)}</div>
                <div className="text-xs text-red-400 font-medium leading-tight mt-0.5">L ${item.low.toFixed(2)}</div>
              </div>
              <MiniSparkline ticker={item.ticker} isPositive={up} />
            </div>

            {/* Actions */}
            <div className="col-span-2 flex items-center justify-end gap-2">
              <button
                onClick={() => router.push(`/stock/${item.ticker}`)}
                className="p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                title="View stock"
              >
                <ExternalLink size={14} />
              </button>
              <button
                onClick={() => remove(item.ticker)}
                className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                title="Remove from watchlist"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
