'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { TrendingUp, TrendingDown, Bot, ExternalLink } from 'lucide-react';

interface Earning {
  period: string; quarter: number; year: number;
  actual: number; estimate: number;
  surprise: number; surprisePercent: number;
}
interface Peer { ticker: string; name: string; price: number; changePct: number; industry: string; }
interface AiReco {
  recommendation: string; confidence_score: number;
  price_target_12m: number; upside_pct: number;
  reasoning: string; score_breakdown: Record<string, { score: number; detail: string }>;
  key_catalysts: string[]; key_risks: string[];
  generated_at?: string;
}

const RECO_COLOR: Record<string, string> = {
  STRONG_BUY: 'text-emerald-400', BUY: 'text-green-400',
  HOLD: 'text-yellow-400', SELL: 'text-orange-400', STRONG_SELL: 'text-red-400',
};
const RECO_BG: Record<string, string> = {
  STRONG_BUY: 'bg-emerald-500/15 border-emerald-500/25', BUY: 'bg-green-500/15 border-green-500/25',
  HOLD: 'bg-yellow-500/15 border-yellow-500/25', SELL: 'bg-orange-500/15 border-orange-500/25',
  STRONG_SELL: 'bg-red-500/15 border-red-500/25',
};

function EarningsBar({ e, maxVal, index }: { e: Earning; maxVal: number; index: number }) {
  const beat = e.actual >= e.estimate;
  const estH = (e.estimate / maxVal) * 100;
  const actH = (e.actual  / maxVal) * 100;
  const qLabel = `Q${e.quarter} '${String(e.year).slice(2)}`;

  return (
    <div className="flex flex-col items-center gap-1.5 flex-1">
      {/* Surprise badge */}
      <div className={`text-xs font-semibold px-1.5 py-0.5 rounded ${beat ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'}`}>
        {beat ? '+' : ''}{e.surprisePercent.toFixed(1)}%
      </div>

      {/* Bars */}
      <div className="relative w-full flex gap-1 items-end" style={{ height: 80 }}>
        {/* Estimate bar */}
        <motion.div
          initial={{ height: 0 }} animate={{ height: `${estH}%` }}
          transition={{ duration: 0.6, delay: index * 0.08, ease: 'easeOut' }}
          className="flex-1 bg-white/10 rounded-t relative"
          title={`Est: $${e.estimate.toFixed(2)}`}
        />
        {/* Actual bar */}
        <motion.div
          initial={{ height: 0 }} animate={{ height: `${actH}%` }}
          transition={{ duration: 0.6, delay: index * 0.08 + 0.1, ease: 'easeOut' }}
          className={`flex-1 rounded-t relative ${beat ? 'bg-green-400' : 'bg-red-400'}`}
          title={`Act: $${e.actual.toFixed(2)}`}
        />
      </div>

      {/* Labels */}
      <div className="text-xs text-gray-500 font-medium">{qLabel}</div>
      <div className="flex gap-1 text-xs">
        <span className="text-gray-600">${e.estimate.toFixed(2)}</span>
        <span className={beat ? 'text-green-400' : 'text-red-400'}>${e.actual.toFixed(2)}</span>
      </div>
    </div>
  );
}

export function AnalystPanel({ ticker }: { ticker: string }) {
  const router = useRouter();
  const [data,    setData]    = useState<{ earnings: Earning[]; peers: Peer[]; epsGrowth: number | null; aiReco: AiReco | null } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/stock/${ticker}/analyst`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [ticker]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1,2,3].map(i => (
          <div key={i} className="bg-[#111] border border-white/5 rounded-2xl p-5 animate-pulse">
            <div className="h-5 bg-white/5 rounded w-40 mb-4" />
            <div className="h-24 bg-white/5 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!data) return null;

  const { earnings, peers, epsGrowth, aiReco } = data;
  const maxEPS = Math.max(...earnings.map(e => Math.max(e.actual, e.estimate)), 0.01);
  const beats  = earnings.filter(e => e.actual >= e.estimate).length;
  const beatPct = earnings.length ? Math.round((beats / earnings.length) * 100) : 0;

  return (
    <div className="space-y-4">

      {/* AI Recommendation */}
      {aiReco && (
        <div className="bg-[#111] border border-white/5 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Bot size={16} className="text-green-400" />
            <h3 className="font-semibold text-white">AI Analyst Recommendation</h3>
            <span className="text-xs text-gray-500 ml-auto">
              {aiReco.generated_at ? new Date(aiReco.generated_at).toLocaleDateString('en-US', { month:'short', day:'numeric' }) : ''}
            </span>
          </div>

          <div className="flex items-start justify-between mb-4 gap-4">
            <div>
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-bold ${RECO_COLOR[aiReco.recommendation]} ${RECO_BG[aiReco.recommendation]}`}>
                {aiReco.recommendation.replace('_', ' ')}
              </div>
              <p className="text-sm text-gray-400 leading-relaxed mt-3 max-w-xl">{aiReco.reasoning}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-2xl font-bold text-white">${Number(aiReco.price_target_12m).toFixed(2)}</div>
              <div className="text-xs text-gray-500">12-month target</div>
              <div className={`text-sm font-semibold mt-0.5 ${Number(aiReco.upside_pct) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {Number(aiReco.upside_pct) >= 0 ? '+' : ''}{Number(aiReco.upside_pct).toFixed(1)}% upside
              </div>
              <div className={`text-xs font-semibold mt-1 ${RECO_COLOR[aiReco.recommendation]}`}>
                {Number(aiReco.confidence_score)}% confident
              </div>
            </div>
          </div>

          {/* Score breakdown */}
          {aiReco.score_breakdown && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {Object.entries(aiReco.score_breakdown).map(([key, val]) => {
                const score = Number(val.score);
                const color = score >= 75 ? 'bg-green-400' : score >= 50 ? 'bg-yellow-400' : 'bg-red-400';
                const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                return (
                  <div key={key} className="bg-white/3 border border-white/5 rounded-xl p-3">
                    <div className="text-xs text-gray-500 mb-1.5">{label}</div>
                    <div className="text-lg font-bold text-white mb-1">{score}</div>
                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }} animate={{ width: `${score}%` }}
                        transition={{ duration: 0.7, ease: 'easeOut' }}
                        className={`h-full rounded-full ${color}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Catalysts + Risks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {aiReco.key_catalysts?.length > 0 && (
              <div>
                <div className="text-xs text-gray-500 font-medium mb-2 uppercase tracking-wide">Key Catalysts</div>
                <div className="space-y-1.5">
                  {aiReco.key_catalysts.map((c, i) => (
                    <div key={i} className="flex gap-2 text-xs text-gray-300">
                      <span className="text-green-400 mt-0.5 flex-shrink-0">●</span>{c}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {aiReco.key_risks?.length > 0 && (
              <div>
                <div className="text-xs text-gray-500 font-medium mb-2 uppercase tracking-wide">Key Risks</div>
                <div className="space-y-1.5">
                  {aiReco.key_risks.map((r, i) => (
                    <div key={i} className="flex gap-2 text-xs text-gray-300">
                      <span className="text-yellow-400 mt-0.5 flex-shrink-0">▲</span>{r}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Earnings history */}
      {earnings.length > 0 && (
        <div className="bg-[#111] border border-white/5 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-semibold text-white">Earnings History</h3>
              <p className="text-xs text-gray-500 mt-0.5">Actual EPS vs Analyst Estimates</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-white/10" />
                <span className="text-gray-500">Estimate</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-green-400" />
                <span className="text-gray-500">Actual</span>
              </div>
              <div className="text-gray-400 font-medium">
                Beat rate: <span className="text-green-400">{beatPct}%</span>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            {earnings.slice(0, 6).reverse().map((e, i) => (
              <EarningsBar key={`${e.year}-Q${e.quarter}`} e={e} maxVal={maxEPS} index={i} />
            ))}
          </div>

          {/* EPS Growth */}
          {epsGrowth !== null && (
            <div className={`mt-4 flex items-center gap-2 text-sm font-medium ${epsGrowth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {epsGrowth >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              EPS growth YoY (last 4Q vs prior 4Q):
              <span className="font-bold">{epsGrowth >= 0 ? '+' : ''}{epsGrowth.toFixed(1)}%</span>
            </div>
          )}
        </div>
      )}

      {/* Peers */}
      {peers.length > 0 && (
        <div className="bg-[#111] border border-white/5 rounded-2xl p-5">
          <h3 className="font-semibold text-white mb-4">Peer Comparison</h3>
          <div className="space-y-1">
            {/* Header */}
            <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium text-gray-600 uppercase tracking-wide">
              <div className="col-span-5">Company</div>
              <div className="col-span-3 text-right">Price</div>
              <div className="col-span-4 text-right">Today</div>
            </div>
            {peers.map((peer, i) => {
              const up = peer.changePct >= 0;
              return (
                <motion.button
                  key={peer.ticker}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  onClick={() => router.push(`/stock/${peer.ticker}`)}
                  className="grid grid-cols-12 gap-2 w-full px-3 py-2.5 hover:bg-white/3 rounded-xl transition-colors items-center text-left"
                >
                  <div className="col-span-5">
                    <div className="text-sm font-semibold text-white">{peer.ticker}</div>
                    <div className="text-xs text-gray-500 truncate">{peer.name}</div>
                  </div>
                  <div className="col-span-3 text-right text-sm font-medium text-white">
                    {peer.price > 0 ? `$${peer.price.toFixed(2)}` : '—'}
                  </div>
                  <div className={`col-span-4 text-right text-sm font-semibold flex items-center justify-end gap-1 ${up ? 'text-green-400' : 'text-red-400'}`}>
                    {peer.price > 0 ? (
                      <>
                        {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {up ? '+' : ''}{peer.changePct.toFixed(2)}%
                      </>
                    ) : '—'}
                    <ExternalLink size={11} className="text-gray-600 ml-1" />
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
