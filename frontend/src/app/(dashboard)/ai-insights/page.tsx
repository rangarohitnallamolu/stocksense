'use client';
import { useEffect, useState, useCallback } from 'react';
import { Topbar } from '@/components/layout/topbar';
import { RecommendationCard } from '@/components/dashboard/recommendation-card';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot, Activity, Newspaper, TrendingUp, TrendingDown,
  RefreshCw, Play, Clock, Zap, AlertTriangle, CheckCircle,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

type Tab = 'recommendations' | 'monitor';

interface AgentRun {
  tickers_scanned?: number;
  tickers_analyzed?: number;
  news_processed?: number;
  catalysts_found?: number;
  high_importance?: number;
  recommendations_new?: number;
  recommendations_changed?: number;
  emails_triggered?: number;
  input_tokens?: number;
  output_tokens?: number;
  cost_usd?: number;
  duration_ms: number;
  run_at: string;
}

interface TokenSummary {
  agent: string;
  total_in: number;
  total_out: number;
  total_cost: number;
  calls: number;
}

interface NewsItem {
  ticker: string;
  headline: string;
  sentiment: string;
  importance_score: number;
  category: string;
  is_catalyst: boolean;
  ai_summary: string;
  analyzed_at: string;
}

interface RecoChange {
  ticker: string;
  prev_recommendation: string;
  new_recommendation: string;
  prev_confidence: number;
  new_confidence: number;
  emails_sent: number;
  changed_at: string;
}

const SENTIMENT_COLOR: Record<string, string> = {
  very_positive: 'text-emerald-400',
  positive:      'text-green-400',
  neutral:       'text-gray-400',
  negative:      'text-orange-400',
  very_negative: 'text-red-400',
};

const RECO_COLOR: Record<string, string> = {
  STRONG_BUY:  'text-emerald-400',
  BUY:         'text-green-400',
  HOLD:        'text-yellow-400',
  SELL:        'text-orange-400',
  STRONG_SELL: 'text-red-400',
};

function StatPill({ label, value, color = 'text-white' }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex flex-col items-center bg-white/5 rounded-xl px-4 py-3 min-w-[90px]">
      <span className={`text-xl font-bold ${color}`}>{value}</span>
      <span className="text-xs text-gray-500 mt-0.5 text-center">{label}</span>
    </div>
  );
}

function AgentCard({
  title, icon: Icon, color, lastRun, runs, stats, onTrigger, triggering,
}: {
  title: string;
  icon: React.ElementType;
  color: string;
  lastRun: AgentRun | null;
  runs: AgentRun[];
  stats: { label: string; key: keyof AgentRun; color?: string }[];
  onTrigger: () => void;
  triggering: boolean;
}) {
  return (
    <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center`}>
            <Icon size={16} className="text-black" />
          </div>
          <div>
            <div className="font-semibold text-white text-sm">{title}</div>
            {lastRun && (
              <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                <Clock size={10} />
                {formatDistanceToNow(new Date(lastRun.run_at), { addSuffix: true })}
                <span className="text-gray-600">· {Math.round(Number(lastRun.duration_ms) / 1000)}s</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-green-400 font-medium">Active</span>
          </div>
          <button
            onClick={onTrigger}
            disabled={triggering}
            className="flex items-center gap-1.5 text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-gray-300 hover:text-white transition-all disabled:opacity-50"
          >
            {triggering
              ? <RefreshCw size={12} className="animate-spin" />
              : <Play size={12} />}
            {triggering ? 'Running…' : 'Run now'}
          </button>
        </div>
      </div>

      {/* Latest run stats */}
      {lastRun ? (
        <div className="flex gap-3 px-5 py-4 flex-wrap border-b border-white/5">
          {stats.map(s => (
            <StatPill
              key={s.key}
              label={s.label}
              value={Number(lastRun[s.key] ?? 0)}
              color={s.color}
            />
          ))}
          <StatPill
            label="Duration"
            value={`${Math.round(Number(lastRun.duration_ms) / 1000)}s`}
          />
        </div>
      ) : (
        <div className="px-5 py-6 text-gray-600 text-sm text-center">No runs yet</div>
      )}

      {/* Run history */}
      <div className="px-5 py-3">
        <div className="text-xs text-gray-500 mb-2 font-medium">RUN HISTORY</div>
        <div className="space-y-1.5 max-h-40 overflow-y-auto">
          {runs.map((run, i) => (
            <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-white/3 last:border-0">
              <span className="text-gray-500">{format(new Date(run.run_at), 'MMM d, HH:mm')}</span>
              <div className="flex gap-3 text-gray-400">
                {stats.map(s => (
                  <span key={s.key}>
                    <span className={s.color || 'text-white'}>{Number(run[s.key] ?? 0)}</span>
                    <span className="text-gray-600 ml-0.5">{s.label.split(' ')[0].toLowerCase()}</span>
                  </span>
                ))}
              </div>
              <span className="text-gray-600">{Math.round(Number(run.duration_ms) / 1000)}s</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ImportanceBadge({ score }: { score: number }) {
  const n = Number(score);
  const color = n >= 8 ? 'bg-red-500/20 text-red-400 border-red-500/30'
    : n >= 6 ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    : 'bg-white/5 text-gray-400 border-white/10';
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${color}`}>
      {n}/10
    </span>
  );
}

export default function AiInsightsPage() {
  const [tab, setTab] = useState<Tab>('monitor');
  const [data, setData] = useState<{
    agent1Runs: AgentRun[];
    agent2Runs: AgentRun[];
    recentNews: NewsItem[];
    recentChanges: RecoChange[];
    tokenSummary: TokenSummary[];
  } | null>(null);
  const [triggering, setTriggering] = useState<'1' | '2' | null>(null);
  const [triggerMsg, setTriggerMsg] = useState('');

  const load = useCallback(() => {
    fetch('/api/agent-runs').then(r => r.json()).then(setData).catch(console.error);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  async function triggerAgent(agent: '1' | '2') {
    setTriggering(agent);
    setTriggerMsg('');
    try {
      await fetch('/api/agent-trigger', { method: 'POST', body: JSON.stringify({ agent }), headers: { 'Content-Type': 'application/json' } });
      setTriggerMsg(`Agent ${agent} triggered — results appear in ~2 min`);
      setTimeout(load, 30000);
    } catch {
      setTriggerMsg('Trigger failed — check Lambda logs');
    } finally {
      setTriggering(null);
    }
  }

  const a1Last = data?.agent1Runs[0] ?? null;
  const a2Last = data?.agent2Runs[0] ?? null;

  return (
    <div className="flex flex-col flex-1">
      <Topbar title="AI Insights" />
      <main className="flex-1 p-6 space-y-6">

        {/* Tabs */}
        <div className="flex gap-1 bg-white/5 rounded-xl p-1 w-fit">
          {(['monitor', 'recommendations'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                tab === t ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {t === 'monitor' ? '🤖 Agent Monitor' : '📊 Recommendations'}
            </button>
          ))}
          <button onClick={load} className="px-3 py-2 rounded-lg text-gray-400 hover:text-white transition-colors">
            <RefreshCw size={14} />
          </button>
        </div>

        {triggerMsg && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 text-sm text-green-400"
          >
            <CheckCircle size={16} /> {triggerMsg}
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {tab === 'monitor' ? (
            <motion.div key="monitor" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">

              {/* Agent cards side by side */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <AgentCard
                  title="Agent 1 — News & Analyst Monitor"
                  icon={Newspaper}
                  color="bg-blue-400"
                  lastRun={a1Last}
                  runs={data?.agent1Runs ?? []}
                  stats={[
                    { label: 'Tickers', key: 'tickers_scanned' },
                    { label: 'News', key: 'news_processed', color: 'text-blue-400' },
                    { label: 'Catalysts', key: 'catalysts_found', color: 'text-green-400' },
                    { label: 'High Imp.', key: 'high_importance', color: 'text-yellow-400' },
                  ]}
                  onTrigger={() => triggerAgent('1')}
                  triggering={triggering === '1'}
                />
                <AgentCard
                  title="Agent 2 — Recommendation Engine"
                  icon={Bot}
                  color="bg-green-400"
                  lastRun={a2Last}
                  runs={data?.agent2Runs ?? []}
                  stats={[
                    { label: 'Analyzed', key: 'tickers_analyzed' },
                    { label: 'New Recos', key: 'recommendations_new', color: 'text-green-400' },
                    { label: 'Changed', key: 'recommendations_changed', color: 'text-yellow-400' },
                    { label: 'Emails', key: 'emails_triggered', color: 'text-blue-400' },
                  ]}
                  onTrigger={() => triggerAgent('2')}
                  triggering={triggering === '2'}
                />
              </div>

              {/* Token usage panel */}
              <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-4 border-b border-white/5">
                  <Zap size={16} className="text-purple-400" />
                  <span className="font-semibold text-white text-sm">Token Usage — Last 24 Hours</span>
                  <span className="ml-auto text-xs text-gray-500">Haiku $0.80/1M in · $4/1M out &nbsp;|&nbsp; Sonnet $3/1M in · $15/1M out</span>
                </div>
                <div className="grid grid-cols-2 divide-x divide-white/5">
                  {['agent1','agent2'].map(agent => {
                    const row = data?.tokenSummary.find(r => r.agent === agent);
                    const totalIn   = Number(row?.total_in   || 0);
                    const totalOut  = Number(row?.total_out  || 0);
                    const totalCost = Number(row?.total_cost || 0);
                    const calls     = Number(row?.calls      || 0);
                    const lastRun   = agent === 'agent1' ? data?.agent1Runs[0] : data?.agent2Runs[0];
                    const lastIn    = Number(lastRun?.input_tokens  || 0);
                    const lastOut   = Number(lastRun?.output_tokens || 0);
                    const lastCost  = Number(lastRun?.cost_usd      || 0);
                    return (
                      <div key={agent} className="p-5">
                        <div className="text-xs text-gray-500 font-medium mb-3 uppercase tracking-wide">
                          {agent === 'agent1' ? '📰 Agent 1 · Claude Haiku' : '🤖 Agent 2 · Claude Sonnet'}
                        </div>
                        <div className="grid grid-cols-2 gap-3 mb-4">
                          <div className="bg-white/5 rounded-xl p-3 text-center">
                            <div className="text-lg font-bold text-blue-400">{totalIn.toLocaleString()}</div>
                            <div className="text-xs text-gray-500">input tokens</div>
                          </div>
                          <div className="bg-white/5 rounded-xl p-3 text-center">
                            <div className="text-lg font-bold text-purple-400">{totalOut.toLocaleString()}</div>
                            <div className="text-xs text-gray-500">output tokens</div>
                          </div>
                          <div className="bg-white/5 rounded-xl p-3 text-center">
                            <div className="text-lg font-bold text-green-400">${totalCost.toFixed(4)}</div>
                            <div className="text-xs text-gray-500">total cost</div>
                          </div>
                          <div className="bg-white/5 rounded-xl p-3 text-center">
                            <div className="text-lg font-bold text-white">{calls}</div>
                            <div className="text-xs text-gray-500">API calls</div>
                          </div>
                        </div>
                        {lastRun && (
                          <div className="border-t border-white/5 pt-3">
                            <div className="text-xs text-gray-600 mb-1.5">LAST RUN</div>
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-400">In: <span className="text-blue-400">{lastIn.toLocaleString()}</span></span>
                              <span className="text-gray-400">Out: <span className="text-purple-400">{lastOut.toLocaleString()}</span></span>
                              <span className="text-gray-400">Cost: <span className="text-green-400">${lastCost.toFixed(5)}</span></span>
                            </div>
                            {calls > 1 && (
                              <div className="text-xs text-gray-600 mt-1">
                                avg per call: ${(totalCost / calls).toFixed(5)}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* Combined total + per-ticker effective cost */}
                <div className="border-t border-white/5 px-5 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Total 24h spend (both agents)</span>
                    <span className="text-sm font-bold text-green-400">
                      ${(data?.tokenSummary.reduce((s,r) => s + Number(r.total_cost), 0) || 0).toFixed(4)}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    {[
                      { label: 'Agent 1 per call', value: '$0.00051', sub: '25% cheaper than before', color: 'text-blue-400' },
                      { label: 'Agent 2 per ticker', value: '$0.00194', sub: '69% cheaper (batched ÷5)', color: 'text-purple-400' },
                      { label: 'Rule-based saves', value: '~63%', sub: 'Agent 1 skips Claude', color: 'text-green-400' },
                    ].map(item => (
                      <div key={item.label} className="bg-white/5 rounded-xl p-3 text-center">
                        <div className={`text-base font-bold ${item.color}`}>{item.value}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{item.label}</div>
                        <div className="text-xs text-gray-600 mt-0.5">{item.sub}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recommendation changes */}
              {(data?.recentChanges?.length ?? 0) > 0 && (
                <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-2 px-5 py-4 border-b border-white/5">
                    <Zap size={16} className="text-yellow-400" />
                    <span className="font-semibold text-white text-sm">Recommendation Changes</span>
                    <span className="text-xs text-gray-500">— triggered email alerts</span>
                  </div>
                  <div className="divide-y divide-white/5">
                    {data?.recentChanges.map((c, i) => (
                      <div key={i} className="flex items-center gap-4 px-5 py-3">
                        <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-white">{c.ticker}</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 text-sm">
                            <span className={`font-medium ${RECO_COLOR[c.prev_recommendation] || 'text-gray-400'}`}>{c.prev_recommendation}</span>
                            <span className="text-gray-600">→</span>
                            <span className={`font-bold ${RECO_COLOR[c.new_recommendation] || 'text-gray-400'}`}>{c.new_recommendation}</span>
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            Confidence: {Number(c.prev_confidence)}% → {Number(c.new_confidence)}%
                            · {Number(c.emails_sent)} email{c.emails_sent !== 1 ? 's' : ''} sent
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 text-right">
                          {formatDistanceToNow(new Date(c.changed_at), { addSuffix: true })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Live news feed from Agent 1 */}
              <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <Activity size={16} className="text-blue-400" />
                    <span className="font-semibold text-white text-sm">News Analyzed by Agent 1</span>
                  </div>
                  <span className="text-xs text-gray-500">{data?.recentNews.length ?? 0} items</span>
                </div>
                <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto">
                  {(data?.recentNews ?? []).length === 0 ? (
                    <div className="px-5 py-8 text-center text-gray-600 text-sm">No news analyzed yet — run Agent 1</div>
                  ) : (data?.recentNews ?? []).map((item, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className="px-5 py-3.5"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {item.is_catalyst
                            ? <Zap size={14} className="text-yellow-400" />
                            : Number(item.importance_score) >= 7
                            ? <AlertTriangle size={14} className="text-orange-400" />
                            : <Activity size={14} className="text-gray-600" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-xs font-bold text-white bg-white/10 px-1.5 py-0.5 rounded">{item.ticker}</span>
                            <ImportanceBadge score={item.importance_score} />
                            <span className={`text-xs font-medium ${SENTIMENT_COLOR[item.sentiment] || 'text-gray-400'}`}>
                              {item.sentiment?.replace(/_/g, ' ')}
                            </span>
                            {item.is_catalyst && (
                              <span className="text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-1.5 py-0.5 rounded font-medium">
                                catalyst
                              </span>
                            )}
                            <span className="text-xs text-gray-600 capitalize">{item.category}</span>
                          </div>
                          <p className="text-xs text-gray-300 leading-relaxed mb-1 line-clamp-2">{item.headline}</p>
                          {item.ai_summary && (
                            <p className="text-xs text-gray-500 leading-relaxed italic">{item.ai_summary}</p>
                          )}
                        </div>
                        <div className="text-xs text-gray-600 flex-shrink-0 text-right">
                          {formatDistanceToNow(new Date(item.analyzed_at), { addSuffix: true })}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div key="recos" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <RecommendationCard />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
