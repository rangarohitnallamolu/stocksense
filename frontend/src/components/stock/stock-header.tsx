'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Star, Plus, Bell } from 'lucide-react';
import Image from 'next/image';
import { AddTradeModal } from '@/components/portfolio/add-trade-modal';
import { CreateAlertModal } from '@/components/alerts/create-alert-modal';
import { authFetch } from '@/lib/api';

interface StockHeaderProps {
  ticker:     string;
  name:       string;
  exchange:   string;
  industry:   string;
  logo:       string;
  price:      number;
  change:     number;
  changePct:  number;
  high:       number;
  low:        number;
  prevClose:  number;
  open:       number;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm font-medium text-white">{value}</span>
    </div>
  );
}

export function StockHeader(props: StockHeaderProps) {
  const { ticker, name, exchange, industry, logo, price, change, changePct, high, low, prevClose, open } = props;
  const [tradeModal, setTradeModal]   = useState(false);
  const [alertModal, setAlertModal]  = useState(false);
  const [watching,   setWatching]    = useState(false);
  const [watchLoading, setWatchLoad] = useState(false);

  useEffect(() => {
    authFetch(`/api/watchlist?check=${ticker}`)
      .then(r => r.json())
      .then(d => setWatching(d.watching ?? false))
      .catch(() => {});
  }, [ticker]);

  async function toggleWatch() {
    setWatchLoad(true);
    try {
      if (watching) {
        await authFetch(`/api/watchlist/${ticker}`, { method: 'DELETE' });
        setWatching(false);
      } else {
        await authFetch('/api/watchlist', { method: 'POST', body: JSON.stringify({ ticker }) });
        setWatching(true);
      }
    } finally { setWatchLoad(false); }
  }
  const up = change >= 0;

  return (
    <div className="bg-[#111] border border-white/5 rounded-2xl p-5">
      {/* Top row */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {logo ? (
            <div className="w-12 h-12 rounded-xl bg-white/5 overflow-hidden flex-shrink-0">
              <Image src={logo} alt={name} width={48} height={48} className="object-contain p-1" unoptimized />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <span className="font-bold text-white text-sm">{ticker.slice(0,2)}</span>
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold text-white leading-tight">{name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-gray-500 font-medium">{ticker}</span>
              <span className="text-gray-700">·</span>
              <span className="text-xs text-gray-500">{exchange}</span>
              {industry && <>
                <span className="text-gray-700">·</span>
                <span className="text-xs text-gray-500">{industry}</span>
              </>}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={toggleWatch}
            disabled={watchLoading}
            className={`flex items-center gap-1.5 text-xs border rounded-xl px-3 py-2 transition-all disabled:opacity-50 ${
              watching
                ? 'bg-yellow-500/15 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/25'
                : 'bg-white/5 border-white/10 text-gray-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <Star size={13} className={watching ? 'fill-yellow-400' : ''} />
            {watching ? 'Watching' : 'Watchlist'}
          </button>
          <button
            onClick={() => setAlertModal(true)}
            className="flex items-center gap-1.5 text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-gray-300 hover:text-white transition-all">
            <Bell size={13} /> Set Alert
          </button>
          <button
            onClick={() => setTradeModal(true)}
            className="flex items-center gap-1.5 text-xs bg-green-500 hover:bg-green-400 rounded-xl px-3 py-2 text-black font-semibold transition-all">
            <Plus size={13} /> Add Trade
          </button>
        </div>
      </div>

      {/* Price */}
      <div className="flex items-end gap-3 mb-4">
        <motion.span
          key={price}
          initial={{ opacity: 0.6 }}
          animate={{ opacity: 1 }}
          className="text-4xl font-bold text-white"
        >
          ${price.toFixed(2)}
        </motion.span>
        <div className={`flex items-center gap-1 mb-1 ${up ? 'text-green-400' : 'text-red-400'}`}>
          {up ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          <span className="text-sm font-semibold">
            {up ? '+' : ''}{change.toFixed(2)} ({up ? '+' : ''}{changePct.toFixed(2)}%)
          </span>
          <span className="text-xs text-gray-500 ml-1">today</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-white/5">
        <Stat label="Open"       value={`$${open.toFixed(2)}`} />
        <Stat label="Prev Close" value={`$${prevClose.toFixed(2)}`} />
        <Stat label="Day High"   value={`$${high.toFixed(2)}`} />
        <Stat label="Day Low"    value={`$${low.toFixed(2)}`} />
      </div>

      <AddTradeModal
        open={tradeModal}
        onClose={() => setTradeModal(false)}
        onAdded={() => setTradeModal(false)}
        defaultTicker={ticker}
      />
      <CreateAlertModal
        open={alertModal}
        onClose={() => setAlertModal(false)}
        onCreated={() => setAlertModal(false)}
        defaultTicker={ticker}
      />
    </div>
  );
}
