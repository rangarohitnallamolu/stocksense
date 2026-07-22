'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bell, TrendingUp, TrendingDown, Newspaper, Bot, BarChart2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authFetch } from '@/lib/api';
import { SearchBar } from '@/components/stock/search-bar';

const ALERT_TYPES = [
  { value: 'price_above',      label: 'Price Above',          icon: TrendingUp,   color: 'text-green-400',  needsThreshold: true,  placeholder: 'e.g. 220.00' },
  { value: 'price_below',      label: 'Price Below',          icon: TrendingDown, color: 'text-red-400',    needsThreshold: true,  placeholder: 'e.g. 150.00' },
  { value: 'earnings',         label: 'Earnings Announcement',icon: BarChart2,    color: 'text-blue-400',   needsThreshold: false, placeholder: '' },
  { value: 'news',             label: 'Breaking News',        icon: Newspaper,    color: 'text-yellow-400', needsThreshold: false, placeholder: '' },
  { value: 'analyst',          label: 'Analyst Change',       icon: TrendingUp,   color: 'text-purple-400', needsThreshold: false, placeholder: '' },
  { value: 'ai_reco_change',   label: 'AI Rating Change',     icon: Bot,          color: 'text-emerald-400',needsThreshold: false, placeholder: '' },
] as const;

interface Props {
  open:           boolean;
  onClose:        () => void;
  onCreated:      () => void;
  defaultTicker?: string;
}

export function CreateAlertModal({ open, onClose, onCreated, defaultTicker }: Props) {
  const [ticker,     setTicker]    = useState(defaultTicker ?? '');
  const [tickerName, setTickerName]= useState('');
  const [alertType, setAlertType] = useState<string>('price_above');
  const [threshold, setThreshold] = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  const selected = ALERT_TYPES.find(t => t.value === alertType)!;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ticker) { setError('Please select a ticker'); return; }
    if (selected.needsThreshold && !threshold) { setError('Please enter a price threshold'); return; }

    setError(''); setLoading(true);
    try {
      const res = await authFetch('/api/alerts', {
        method: 'POST',
        body: JSON.stringify({
          ticker,
          alert_type: alertType,
          threshold: selected.needsThreshold ? Number(threshold) : null,
        }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Failed'); return; }
      onCreated();
      onClose();
      setTicker(defaultTicker ?? ''); setTickerName(''); setThreshold('');
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  }

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

        <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative bg-[#161616] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">

          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-green-400" />
              <h2 className="font-semibold text-white">Create Alert</h2>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-5">
            {/* Ticker */}
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">Stock</label>
              {defaultTicker ? (
                <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white">
                  {defaultTicker}
                </div>
              ) : ticker ? (
                <div className="flex items-center justify-between bg-white/5 border border-green-500/30 rounded-xl px-4 py-3">
                  <div>
                    <span className="text-sm font-bold text-white">{ticker}</span>
                    {tickerName && <span className="text-xs text-gray-400 ml-2">{tickerName}</span>}
                  </div>
                  <button type="button" onClick={() => { setTicker(''); setTickerName(''); }}
                    className="text-xs text-gray-500 hover:text-white transition-colors">
                    Change
                  </button>
                </div>
              ) : (
                <SearchBar
                  className="w-full"
                  onSelect={(t, n) => { setTicker(t); setTickerName(n); }}
                />
              )}
            </div>

            {/* Alert Type */}
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">Alert Type</label>
              <div className="grid grid-cols-2 gap-2">
                {ALERT_TYPES.map(t => {
                  const Icon = t.icon;
                  const active = alertType === t.value;
                  return (
                    <button key={t.value} type="button" onClick={() => setAlertType(t.value)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all text-sm ${
                        active
                          ? `border-white/20 bg-white/10 ${t.color} font-medium`
                          : 'border-white/5 bg-white/3 text-gray-400 hover:bg-white/5 hover:text-white'
                      }`}>
                      <Icon size={14} className={active ? t.color : 'text-gray-500'} />
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Threshold */}
            {selected.needsThreshold && (
              <Input
                label={`Alert when price ${alertType === 'price_above' ? 'rises above' : 'falls below'}`}
                type="number"
                placeholder={selected.placeholder}
                value={threshold}
                onChange={e => setThreshold(e.target.value)}
                min="0.01" step="0.01"
                required
              />
            )}

            {/* Description */}
            <div className="bg-white/3 border border-white/5 rounded-xl px-4 py-3 text-xs text-gray-400">
              {alertType === 'price_above'    && `You'll be notified when ${ticker || 'this stock'} rises above $${threshold || '—'}`}
              {alertType === 'price_below'    && `You'll be notified when ${ticker || 'this stock'} falls below $${threshold || '—'}`}
              {alertType === 'earnings'       && `You'll be notified before ${ticker || 'this stock'}'s earnings announcement`}
              {alertType === 'news'           && `You'll be notified on high-importance breaking news for ${ticker || 'this stock'}`}
              {alertType === 'analyst'        && `You'll be notified when analysts upgrade or downgrade ${ticker || 'this stock'}`}
              {alertType === 'ai_reco_change' && `You'll be notified when our AI changes its rating on ${ticker || 'this stock'}`}
            </div>

            {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">{error}</p>}

            <Button type="submit" size="full" loading={loading}>
              {loading ? 'Creating...' : 'Create Alert'}
            </Button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
