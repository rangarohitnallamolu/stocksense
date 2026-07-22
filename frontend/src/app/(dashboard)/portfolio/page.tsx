'use client';
import { useEffect, useState, useCallback } from 'react';
import { Topbar } from '@/components/layout/topbar';
import { PortfolioSummary } from '@/components/portfolio/portfolio-summary';
import { HoldingsTable } from '@/components/portfolio/holdings-table';
import { AddTradeModal } from '@/components/portfolio/add-trade-modal';
import { useAuth } from '@/hooks/use-auth';
import { authFetch } from '@/lib/api';
import { Plus, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';

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

export default function PortfolioPage() {
  const { ready } = useAuth();
  const [holdings,   setHoldings]  = useState<Holding[]>([]);
  const [loading,    setLoading]   = useState(true);
  const [refreshing, setRefreshing]= useState(false);
  const [modalOpen,  setModal]     = useState(false);
  const [modalTicker,setMTicker]   = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await authFetch('/api/portfolio/holdings');
      if (res.ok) setHoldings(await res.json());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { if (ready) load(); }, [ready, load]);

  function openAddTrade(ticker = '') {
    setMTicker(ticker);
    setModal(true);
  }

  return (
    <div className="flex flex-col flex-1">
      <Topbar title="Portfolio" />
      <main className="flex-1 p-6 space-y-6">

        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">My Portfolio</h2>
            <p className="text-gray-500 text-sm mt-0.5">Track your investments and P&amp;L</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-xl transition-all disabled:opacity-40"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => openAddTrade()}
              className="flex items-center gap-2 text-sm font-semibold text-black bg-green-500 hover:bg-green-400 px-4 py-2 rounded-xl transition-all"
            >
              <Plus size={16} /> Add Trade
            </motion.button>
          </div>
        </div>

        {/* Summary cards */}
        <PortfolioSummary holdings={holdings} loading={loading} />

        {/* Holdings */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">Holdings</h3>
            {!loading && holdings.length > 0 && (
              <span className="text-xs text-gray-500">{holdings.length} position{holdings.length !== 1 ? 's' : ''}</span>
            )}
          </div>

          {loading ? (
            <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden">
              {[1,2,3].map(i => (
                <div key={i} className="grid grid-cols-12 gap-2 px-5 py-4 border-b border-white/5 last:border-0 animate-pulse">
                  <div className="col-span-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/5" />
                    <div className="space-y-1">
                      <div className="h-3 bg-white/5 rounded w-12" />
                      <div className="h-2 bg-white/5 rounded w-16" />
                    </div>
                  </div>
                  {[1,2,3,4,5].map(j => (
                    <div key={j} className="col-span-2 flex items-center justify-end">
                      <div className="h-3 bg-white/5 rounded w-16" />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <HoldingsTable
              holdings={holdings}
              onAddTrade={openAddTrade}
              onRefresh={() => load(true)}
            />
          )}
        </div>
      </main>

      <AddTradeModal
        open={modalOpen}
        onClose={() => setModal(false)}
        onAdded={() => load(true)}
        defaultTicker={modalTicker}
      />
    </div>
  );
}
