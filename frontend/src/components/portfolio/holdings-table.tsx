'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { TrendingUp, TrendingDown, ChevronDown, Plus, Trash2, ExternalLink } from 'lucide-react';
import { authFetch } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';

interface Holding {
  ticker:         string;
  total_shares:   number;
  avg_cost:       number;
  total_invested: number;
  current_price:  number;
  current_value:  number;
  gain:           number;
  gain_pct:       number;
  day_change:     number;
  day_change_pct: number;
}

interface Transaction {
  id:         string;
  ticker:     string;
  type:       'buy' | 'sell';
  shares:     number;
  price:      number;
  trade_date: string;
  notes:      string | null;
  created_at: string;
}

function fmt(n: number, dec = 2) { return n.toFixed(dec); }
function fmtDollar(n: number)    { return `${n >= 0 ? '+' : ''}$${Math.abs(n).toFixed(2)}`; }
function fmtPct(n: number)       { return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`; }

interface Props {
  holdings:  Holding[];
  onAddTrade: (ticker: string) => void;
  onRefresh:  () => void;
}

export function HoldingsTable({ holdings, onAddTrade, onRefresh }: Props) {
  const router = useRouter();
  const [expanded, setExpanded]     = useState<string | null>(null);
  const [txns, setTxns]             = useState<Record<string, Transaction[]>>({});
  const [loadingTxn, setLoadingTxn] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function toggleExpand(ticker: string) {
    if (expanded === ticker) { setExpanded(null); return; }
    setExpanded(ticker);
    if (txns[ticker]) return;

    setLoadingTxn(ticker);
    try {
      const res  = await authFetch(`/api/portfolio/transactions?ticker=${ticker}`);
      const data = await res.json();
      setTxns(prev => ({ ...prev, [ticker]: data }));
    } finally { setLoadingTxn(null); }
  }

  async function deleteTxn(ticker: string, id: string) {
    setDeletingId(id);
    try {
      await authFetch(`/api/portfolio/transactions/${id}`, { method: 'DELETE' });
      setTxns(prev => ({
        ...prev,
        [ticker]: (prev[ticker] || []).filter(t => t.id !== id),
      }));
      onRefresh();
    } finally { setDeletingId(null); }
  }

  if (!holdings.length) {
    return (
      <div className="bg-[#111] border border-white/5 rounded-2xl p-12 text-center">
        <div className="text-4xl mb-3">📊</div>
        <p className="text-white font-medium mb-1">No holdings yet</p>
        <p className="text-gray-500 text-sm">Add your first trade to start tracking your portfolio</p>
      </div>
    );
  }

  return (
    <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden">
      {/* Table header */}
      <div className="grid grid-cols-12 gap-2 px-5 py-3 border-b border-white/5 text-xs font-medium text-gray-500 uppercase tracking-wide">
        <div className="col-span-3">Stock</div>
        <div className="col-span-1 text-right">Shares</div>
        <div className="col-span-2 text-right">Avg Cost</div>
        <div className="col-span-2 text-right">Current</div>
        <div className="col-span-2 text-right">Value</div>
        <div className="col-span-2 text-right">Gain / Loss</div>
      </div>

      {holdings.map(h => {
        const up      = h.gain >= 0;
        const dayUp   = h.day_change >= 0;
        const isOpen  = expanded === h.ticker;

        return (
          <div key={h.ticker} className="border-b border-white/5 last:border-0">
            {/* Main row */}
            <div
              className="grid grid-cols-12 gap-2 px-5 py-4 hover:bg-white/2 cursor-pointer items-center transition-colors"
              onClick={() => toggleExpand(h.ticker)}
            >
              {/* Stock */}
              <div className="col-span-3 flex items-center gap-3">
                <ChevronDown size={14} className={`text-gray-500 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
                <div>
                  <div className="font-semibold text-white text-sm">{h.ticker}</div>
                  <div className={`text-xs ${dayUp ? 'text-green-400' : 'text-red-400'}`}>
                    {fmtDollar(h.day_change)} today
                  </div>
                </div>
              </div>

              {/* Shares */}
              <div className="col-span-1 text-right text-sm text-white font-medium">
                {Number(h.total_shares).toFixed(4).replace(/\.?0+$/, '')}
              </div>

              {/* Avg Cost */}
              <div className="col-span-2 text-right text-sm text-gray-300">
                ${fmt(Number(h.avg_cost))}
              </div>

              {/* Current Price */}
              <div className="col-span-2 text-right">
                <div className="text-sm text-white font-medium">${fmt(h.current_price)}</div>
                <div className={`text-xs ${dayUp ? 'text-green-400' : 'text-red-400'}`}>
                  {fmtPct(Number(h.day_change_pct))}
                </div>
              </div>

              {/* Current Value */}
              <div className="col-span-2 text-right text-sm text-white font-medium">
                ${Number(h.current_value).toFixed(2)}
              </div>

              {/* Gain / Loss */}
              <div className="col-span-2 text-right">
                <div className={`text-sm font-semibold flex items-center justify-end gap-1 ${up ? 'text-green-400' : 'text-red-400'}`}>
                  {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {fmtDollar(Number(h.gain))}
                </div>
                <div className={`text-xs ${up ? 'text-green-400' : 'text-red-400'}`}>
                  {fmtPct(Number(h.gain_pct))}
                </div>
              </div>
            </div>

            {/* Expanded: transaction history */}
            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="bg-[#0d0d0d] border-t border-white/5 px-5 py-4">
                    {/* Action bar */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Transactions</span>
                      <div className="flex gap-2">
                        <button
                          onClick={e => { e.stopPropagation(); router.push(`/stock/${h.ticker}`); }}
                          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-all"
                        >
                          <ExternalLink size={11} /> View Stock
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); onAddTrade(h.ticker); }}
                          className="flex items-center gap-1.5 text-xs text-green-400 hover:text-green-300 bg-green-500/10 hover:bg-green-500/20 px-3 py-1.5 rounded-lg transition-all"
                        >
                          <Plus size={11} /> Add Trade
                        </button>
                      </div>
                    </div>

                    {loadingTxn === h.ticker ? (
                      <div className="text-xs text-gray-500 py-4 text-center">Loading...</div>
                    ) : (txns[h.ticker] ?? []).length === 0 ? (
                      <div className="text-xs text-gray-600 py-2 text-center">No transactions found</div>
                    ) : (
                      <div className="space-y-1.5">
                        {(txns[h.ticker] ?? []).map(t => (
                          <div key={t.id}
                            className="flex items-center justify-between bg-white/3 rounded-xl px-4 py-2.5 group">
                            <div className="flex items-center gap-3">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded capitalize ${
                                t.type === 'buy'
                                  ? 'bg-green-500/15 text-green-400'
                                  : 'bg-red-500/15 text-red-400'
                              }`}>{t.type}</span>
                              <div>
                                <span className="text-sm text-white font-medium">
                                  {Number(t.shares)} shares @ ${Number(t.price).toFixed(2)}
                                </span>
                                <span className="text-xs text-gray-500 ml-2">
                                  = ${(Number(t.shares) * Number(t.price)).toFixed(2)}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <div className="text-xs text-gray-400">
                                  {new Date(t.trade_date).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}
                                </div>
                                {t.notes && <div className="text-xs text-gray-600 truncate max-w-[120px]">{t.notes}</div>}
                              </div>
                              <button
                                onClick={e => { e.stopPropagation(); deleteTxn(h.ticker, t.id); }}
                                disabled={deletingId === t.id}
                                className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all p-1 rounded disabled:opacity-30"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
