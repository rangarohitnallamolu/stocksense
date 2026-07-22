'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, BellOff, Trash2, TrendingUp, TrendingDown, Newspaper, Bot, BarChart2 } from 'lucide-react';
import { authFetch } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';

interface Alert {
  id: string; ticker: string; alert_type: string;
  threshold: number | null; is_active: boolean; created_at: string;
}

interface HistoryItem {
  id: string; ticker: string; message: string;
  email_sent: boolean; fired_at: string;
}

const TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  price_above:    { label: 'Price Above',    icon: TrendingUp,   color: 'text-green-400'  },
  price_below:    { label: 'Price Below',    icon: TrendingDown, color: 'text-red-400'    },
  earnings:       { label: 'Earnings',       icon: BarChart2,    color: 'text-blue-400'   },
  news:           { label: 'Breaking News',  icon: Newspaper,    color: 'text-yellow-400' },
  analyst:        { label: 'Analyst Change', icon: TrendingUp,   color: 'text-purple-400' },
  ai_reco_change: { label: 'AI Rating',      icon: Bot,          color: 'text-emerald-400'},
};

interface Props {
  alerts:   Alert[];
  history:  HistoryItem[];
  onChange: () => void;
}

export function AlertsList({ alerts, history, onChange }: Props) {
  async function toggle(alert: Alert) {
    await authFetch(`/api/alerts/${alert.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: !alert.is_active }),
    });
    onChange();
  }

  async function remove(id: string) {
    await authFetch(`/api/alerts/${id}`, { method: 'DELETE' });
    onChange();
  }

  return (
    <div className="space-y-6">
      {/* Active Alerts */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Active Alerts</h3>
          <span className="text-xs text-gray-500">{alerts.filter(a => a.is_active).length} active / {alerts.length} total</span>
        </div>

        {alerts.length === 0 ? (
          <div className="bg-[#111] border border-white/5 rounded-2xl p-10 text-center">
            <Bell size={32} className="text-gray-700 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">No alerts set</p>
            <p className="text-gray-600 text-sm mt-1">Create an alert to get notified when something happens</p>
          </div>
        ) : (
          <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden">
            <AnimatePresence>
              {alerts.map((alert, i) => {
                const cfg = TYPE_CONFIG[alert.alert_type] || TYPE_CONFIG.news;
                const Icon = cfg.icon;
                return (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className={`flex items-center gap-4 px-5 py-4 border-b border-white/5 last:border-0 transition-opacity ${!alert.is_active ? 'opacity-50' : ''}`}
                  >
                    {/* Icon */}
                    <div className={`w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
                      <Icon size={16} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-white">{alert.ticker}</span>
                        <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                        {alert.threshold && (
                          <span className="text-xs bg-white/5 text-gray-300 px-2 py-0.5 rounded font-mono">
                            ${Number(alert.threshold).toFixed(2)}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        Created {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                      </div>
                    </div>

                    {/* Toggle + Delete */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => toggle(alert)}
                        className={`p-2 rounded-lg transition-all ${alert.is_active ? 'text-green-400 bg-green-500/10 hover:bg-green-500/20' : 'text-gray-500 bg-white/5 hover:bg-white/10 hover:text-white'}`}
                        title={alert.is_active ? 'Disable alert' : 'Enable alert'}>
                        {alert.is_active ? <Bell size={15} /> : <BellOff size={15} />}
                      </button>
                      <button onClick={() => remove(alert.id)}
                        className="p-2 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        title="Delete alert">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Alert History */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">Alert History</h3>
        {history.length === 0 ? (
          <div className="bg-[#111] border border-white/5 rounded-2xl p-8 text-center">
            <p className="text-gray-600 text-sm">No alerts have fired yet</p>
          </div>
        ) : (
          <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden">
            {history.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-start gap-4 px-5 py-3.5 border-b border-white/5 last:border-0"
              >
                <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0 mt-1.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-bold text-white bg-white/5 px-1.5 py-0.5 rounded">{item.ticker}</span>
                    {item.email_sent && (
                      <span className="text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded">email sent</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-300">{item.message}</p>
                </div>
                <div className="text-xs text-gray-500 flex-shrink-0">
                  {formatDistanceToNow(new Date(item.fired_at), { addSuffix: true })}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
