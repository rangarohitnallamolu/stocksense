'use client';
import { useEffect, useState, useCallback } from 'react';
import { Topbar } from '@/components/layout/topbar';
import { WatchlistTable } from '@/components/watchlist/watchlist-table';
import { useAuth } from '@/hooks/use-auth';
import { authFetch } from '@/lib/api';
import { RefreshCw } from 'lucide-react';

interface WatchItem {
  ticker: string; price: number; change: number;
  changePct: number; high: number; low: number;
  prevClose: number; added_at: string;
}

export default function WatchlistPage() {
  const { ready }                     = useAuth();
  const [items,      setItems]        = useState<WatchItem[]>([]);
  const [loading,    setLoading]      = useState(true);
  const [refreshing, setRefreshing]   = useState(false);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const res = await authFetch('/api/watchlist');
      if (res.ok) setItems(await res.json());
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { if (ready) load(); }, [ready, load]);

  return (
    <div className="flex flex-col flex-1">
      <Topbar title="Watchlist" />
      <main className="flex-1 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">My Watchlist</h2>
            <p className="text-gray-500 text-sm mt-0.5">
              Search any stock and click "Watchlist" on its page to add it
            </p>
          </div>
          <button onClick={() => load(true)} disabled={refreshing}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-xl transition-all disabled:opacity-40">
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh prices
          </button>
        </div>

        {loading ? (
          <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden">
            {[1,2,3,4].map(i => (
              <div key={i} className="grid grid-cols-12 gap-2 px-5 py-4 border-b border-white/5 animate-pulse">
                <div className="col-span-4"><div className="h-4 bg-white/5 rounded w-16" /></div>
                <div className="col-span-2 flex justify-end"><div className="h-4 bg-white/5 rounded w-20" /></div>
                <div className="col-span-2 flex justify-end"><div className="h-4 bg-white/5 rounded w-16" /></div>
                <div className="col-span-2 flex justify-end"><div className="h-4 bg-white/5 rounded w-24" /></div>
                <div className="col-span-2" />
              </div>
            ))}
          </div>
        ) : (
          <WatchlistTable
            items={items}
            onRemoved={ticker => setItems(prev => prev.filter(i => i.ticker !== ticker))}
          />
        )}
      </main>
    </div>
  );
}
