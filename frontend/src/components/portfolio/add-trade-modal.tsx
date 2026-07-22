'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authFetch } from '@/lib/api';

interface SearchResult { ticker: string; name: string; }

interface Props {
  open:        boolean;
  onClose:     () => void;
  onAdded:     () => void;
  defaultTicker?: string;
}

export function AddTradeModal({ open, onClose, onAdded, defaultTicker }: Props) {
  const [type,       setType]   = useState<'buy' | 'sell'>('buy');
  const [ticker,     setTicker] = useState(defaultTicker ?? '');
  const [tickerName, setName]   = useState('');
  const [shares,     setShares] = useState('');
  const [price,      setPrice]  = useState('');
  const [date,       setDate]   = useState(new Date().toISOString().split('T')[0]);
  const [notes,      setNotes]  = useState('');
  const [loading,    setLoad]   = useState(false);
  const [error,      setError]  = useState('');
  const [results,    setResults]= useState<SearchResult[]>([]);
  const [searching,  setSearching] = useState(false);
  const [showDrop,   setDrop]   = useState(false);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (defaultTicker) { setTicker(defaultTicker); setName(''); }
  }, [defaultTicker, open]);

  const searchTicker = useCallback((q: string) => {
    if (searchRef.current) clearTimeout(searchRef.current);
    if (!q.trim()) { setResults([]); return; }
    searchRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await fetch(`/api/stock/search?q=${encodeURIComponent(q)}`);
        setResults(await r.json());
        setDrop(true);
      } finally { setSearching(false); }
    }, 300);
  }, []);

  function selectTicker(r: SearchResult) {
    setTicker(r.ticker);
    setName(r.name);
    setDrop(false);
    setResults([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!ticker || !shares || !price || !date) { setError('All fields are required'); return; }
    setLoad(true);
    try {
      const res = await authFetch('/api/portfolio/transactions', {
        method: 'POST',
        body: JSON.stringify({ ticker, type, shares: Number(shares), price: Number(price), trade_date: date, notes }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Failed to save'); return; }
      onAdded();
      onClose();
      setShares(''); setPrice(''); setNotes('');
    } catch { setError('Network error'); }
    finally { setLoad(false); }
  }

  if (!open) return null;

  const total = shares && price ? (Number(shares) * Number(price)).toFixed(2) : null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1,    y: 0  }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative bg-[#161616] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <h2 className="font-semibold text-white">Add Trade</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Buy / Sell toggle */}
            <div className="flex rounded-xl overflow-hidden border border-white/10">
              {(['buy','sell'] as const).map(t => (
                <button key={t} type="button" onClick={() => setType(t)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-all capitalize ${
                    type === t
                      ? t === 'buy' ? 'bg-green-500 text-black' : 'bg-red-500 text-white'
                      : 'text-gray-400 hover:text-white bg-transparent'
                  }`}>
                  {t === 'buy' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {t}
                </button>
              ))}
            </div>

            {/* Ticker search */}
            <div className="relative">
              <div className="relative">
                {searching
                  ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full" />
                  : <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />}
                <input
                  value={ticker}
                  onChange={e => { setTicker(e.target.value.toUpperCase()); searchTicker(e.target.value); }}
                  onFocus={() => ticker && setDrop(true)}
                  placeholder="Search ticker (e.g. AAPL)"
                  className="w-full bg-white/5 border border-white/10 focus:border-green-500 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-gray-500 outline-none transition-colors uppercase"
                  required
                />
              </div>
              {tickerName && <p className="text-xs text-gray-400 mt-1 pl-1">{tickerName}</p>}
              {showDrop && results.length > 0 && (
                <div className="absolute top-full mt-1 left-0 right-0 bg-[#1e1e1e] border border-white/10 rounded-xl overflow-hidden z-10 shadow-xl">
                  {results.map(r => (
                    <button key={r.ticker} type="button" onMouseDown={() => selectTicker(r)}
                      className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-white/5 text-left transition-colors">
                      <span className="text-sm font-bold text-white w-16">{r.ticker}</span>
                      <span className="text-xs text-gray-400 truncate">{r.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Shares + Price */}
            <div className="grid grid-cols-2 gap-3">
              <Input label="Shares" type="number" placeholder="10" min="0.0001" step="any"
                value={shares} onChange={e => setShares(e.target.value)} required />
              <Input label="Price / share" type="number" placeholder="150.00" min="0.01" step="any"
                value={price} onChange={e => setPrice(e.target.value)} required />
            </div>

            {/* Date */}
            <Input label="Trade date" type="date" value={date}
              onChange={e => setDate(e.target.value)} required />

            {/* Notes */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-300">Notes (optional)</label>
              <textarea
                value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="E.g. Earnings play, long-term hold..."
                rows={2}
                className="bg-white/5 border border-white/10 focus:border-green-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-gray-500 outline-none resize-none transition-colors"
              />
            </div>

            {/* Total */}
            {total && (
              <div className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm ${
                type === 'buy' ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'
              }`}>
                <span className="text-gray-400">Total {type === 'buy' ? 'cost' : 'proceeds'}</span>
                <span className={`font-bold ${type === 'buy' ? 'text-green-400' : 'text-red-400'}`}>${total}</span>
              </div>
            )}

            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">{error}</p>
            )}

            <Button type="submit" size="full" loading={loading}
              className={type === 'sell' ? 'bg-red-500 hover:bg-red-400 text-white' : ''}>
              {loading ? 'Saving...' : `Record ${type === 'buy' ? 'Buy' : 'Sell'}`}
            </Button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
