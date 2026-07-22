'use client';
import { useEffect, useState, useCallback } from 'react';
import { Topbar } from '@/components/layout/topbar';
import { AlertsList } from '@/components/alerts/alerts-list';
import { CreateAlertModal } from '@/components/alerts/create-alert-modal';
import { useAuth } from '@/hooks/use-auth';
import { authFetch } from '@/lib/api';
import { Bell, Plus } from 'lucide-react';
import { motion } from 'framer-motion';

interface Alert {
  id: string; ticker: string; alert_type: string;
  threshold: number | null; is_active: boolean; created_at: string;
}
interface HistoryItem {
  id: string; ticker: string; message: string;
  email_sent: boolean; fired_at: string;
}

export default function AlertsPage() {
  const { ready }                   = useAuth();
  const [alerts,  setAlerts]        = useState<Alert[]>([]);
  const [history, setHistory]       = useState<HistoryItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [modal,   setModal]         = useState(false);

  const load = useCallback(async () => {
    try {
      const res  = await authFetch('/api/alerts');
      if (res.ok) {
        const d = await res.json();
        setAlerts(d.alerts   || []);
        setHistory(d.history || []);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (ready) load(); }, [ready, load]);

  return (
    <div className="flex flex-col flex-1">
      <Topbar title="Alerts" />
      <main className="flex-1 p-6 space-y-6 max-w-3xl mx-auto w-full">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">My Alerts</h2>
            <p className="text-gray-500 text-sm mt-0.5">Get notified when something important happens</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={() => setModal(true)}
            className="flex items-center gap-2 text-sm font-semibold text-black bg-green-500 hover:bg-green-400 px-4 py-2 rounded-xl transition-all"
          >
            <Plus size={16} /> Create Alert
          </motion.button>
        </div>

        {/* Alert types info */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { emoji: '📈', label: 'Price Alerts', desc: 'Above or below a price' },
            { emoji: '📰', label: 'News Alerts',  desc: 'Breaking news & earnings' },
            { emoji: '🤖', label: 'AI Alerts',    desc: 'Rating & analyst changes' },
          ].map(card => (
            <div key={card.label} className="bg-[#111] border border-white/5 rounded-2xl p-4 text-center">
              <div className="text-2xl mb-1">{card.emoji}</div>
              <div className="text-sm font-semibold text-white">{card.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{card.desc}</div>
            </div>
          ))}
        </div>

        {/* Alerts list */}
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="bg-[#111] border border-white/5 rounded-2xl p-5 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-xl bg-white/5" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-white/5 rounded w-32" />
                    <div className="h-3 bg-white/5 rounded w-20" />
                  </div>
                  <div className="flex gap-2">
                    <div className="w-8 h-8 bg-white/5 rounded-lg" />
                    <div className="w-8 h-8 bg-white/5 rounded-lg" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <AlertsList alerts={alerts} history={history} onChange={load} />
        )}
      </main>

      <CreateAlertModal
        open={modal}
        onClose={() => setModal(false)}
        onCreated={load}
      />
    </div>
  );
}
