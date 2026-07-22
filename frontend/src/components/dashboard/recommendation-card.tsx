'use client';
import { motion } from 'framer-motion';
import { Bot, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';

interface Recommendation {
  ticker: string;
  recommendation: string;
  confidence_score: number;
  price_at_analysis: number;
  price_target_12m: number;
  upside_pct: number;
  reasoning: string;
  score_breakdown: Record<string, { score: number; detail: string }>;
  key_catalysts: string[];
  key_risks: string[];
  generated_at: string;
}

const RECO_CONFIG = {
  STRONG_BUY:  { label: 'Strong Buy',  color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: TrendingUp },
  BUY:         { label: 'Buy',         color: 'text-green-400',   bg: 'bg-green-500/10',   border: 'border-green-500/20',   icon: TrendingUp },
  HOLD:        { label: 'Hold',        color: 'text-yellow-400',  bg: 'bg-yellow-500/10',  border: 'border-yellow-500/20',  icon: Minus },
  SELL:        { label: 'Sell',        color: 'text-orange-400',  bg: 'bg-orange-500/10',  border: 'border-orange-500/20',  icon: TrendingDown },
  STRONG_SELL: { label: 'Strong Sell', color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/20',     icon: TrendingDown },
};

function ConfidenceBar({ score, color }: { score: number; color: string }) {
  return (
    <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${score}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className={`h-full rounded-full ${color.replace('text-', 'bg-')}`}
      />
    </div>
  );
}

function RecoRow({ reco, onClick }: { reco: Recommendation; onClick: () => void }) {
  const cfg = RECO_CONFIG[reco.recommendation as keyof typeof RECO_CONFIG] || RECO_CONFIG.HOLD;
  const Icon = cfg.icon;
  const upside = reco.upside_pct > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ x: 2 }}
      onClick={onClick}
      className="flex items-center gap-4 px-4 py-3.5 hover:bg-white/3 rounded-xl cursor-pointer transition-colors group"
    >
      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
        <span className="text-xs font-bold text-white">{reco.ticker.slice(0, 4)}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-white text-sm">{reco.ticker}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.color} ${cfg.bg} ${cfg.border}`}>
            <Icon size={10} className="inline mr-1" />{cfg.label}
          </span>
        </div>
        <ConfidenceBar score={reco.confidence_score} color={cfg.color} />
      </div>
      <div className="text-right flex-shrink-0">
        <div className="text-sm font-semibold text-white">{reco.confidence_score}%</div>
        <div className={`text-xs font-medium ${upside ? 'text-green-400' : 'text-red-400'}`}>
          {upside ? '+' : ''}{reco.upside_pct?.toFixed(1)}% target
        </div>
      </div>
    </motion.div>
  );
}

function RecoDetail({ reco, onClose }: { reco: Recommendation; onClose: () => void }) {
  const cfg = RECO_CONFIG[reco.recommendation as keyof typeof RECO_CONFIG] || RECO_CONFIG.HOLD;
  const breakdown = reco.score_breakdown || {};
  const weights: Record<string, number> = {
    analyst_consensus: 25, news_sentiment: 20, financial_health: 25, growth_catalysts: 30
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="border-t border-white/5 mt-2 pt-4 px-4 pb-4"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="text-xl font-bold text-white">{reco.ticker}</span>
          <span className={`ml-2 text-sm font-semibold ${cfg.color}`}>{cfg.label}</span>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-green-400">${reco.price_target_12m}</div>
          <div className="text-xs text-gray-400">12-month target</div>
        </div>
      </div>

      <p className="text-sm text-gray-300 leading-relaxed mb-4">{reco.reasoning}</p>

      {/* Score breakdown */}
      <div className="space-y-2.5 mb-4">
        {Object.entries(breakdown).map(([key, val]) => (
          <div key={key}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-400 capitalize">{key.replace(/_/g, ' ')} <span className="text-gray-600">×{weights[key]}%</span></span>
              <span className="text-white font-medium">{val.score}/100</span>
            </div>
            <ConfidenceBar score={val.score} color={cfg.color} />
            <div className="text-xs text-gray-500 mt-0.5">{val.detail}</div>
          </div>
        ))}
      </div>

      {/* Catalysts */}
      {reco.key_catalysts?.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-gray-500 mb-1.5">KEY CATALYSTS</div>
          {reco.key_catalysts.map((c, i) => (
            <div key={i} className="flex gap-2 text-xs text-gray-300 mb-1">
              <span className="text-green-400 mt-0.5">●</span>{c}
            </div>
          ))}
        </div>
      )}

      {/* Risks */}
      {reco.key_risks?.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-gray-500 mb-1.5">KEY RISKS</div>
          {reco.key_risks.map((r, i) => (
            <div key={i} className="flex gap-2 text-xs text-gray-300 mb-1">
              <span className="text-yellow-400 mt-0.5">▲</span>{r}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-600">Not financial advice · AI-generated</p>
        <button onClick={onClose} className="text-xs text-gray-400 hover:text-white transition-colors">Close ↑</button>
      </div>
    </motion.div>
  );
}

export function RecommendationCard() {
  const [recos, setRecos] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [agentStatus, setAgentStatus] = useState<{ agent1: Record<string, unknown> | null; agent2: Record<string, unknown> | null }>({ agent1: null, agent2: null });

  useEffect(() => {
    Promise.all([
      fetch('/api/recommendations').then(r => r.json()),
      fetch('/api/agent-status').then(r => r.json()),
    ]).then(([r, s]) => {
      // pg returns DECIMAL columns as strings — coerce all numeric fields here
      const parsed = (Array.isArray(r) ? r : []).map((rec: Recommendation) => ({
        ...rec,
        confidence_score: Number(rec.confidence_score),
        price_at_analysis: Number(rec.price_at_analysis),
        price_target_12m:  Number(rec.price_target_12m),
        upside_pct:        Number(rec.upside_pct),
      }));
      setRecos(parsed);
      setAgentStatus(s);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const sorted = [...recos].sort((a, b) => b.confidence_score - a.confidence_score).slice(0, 8);

  return (
    <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Bot size={18} className="text-green-400" />
          <span className="font-semibold text-white">AI Recommendations</span>
          <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">Live</span>
        </div>
        {agentStatus.agent2 && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <RefreshCw size={11} />
            {formatDistanceToNow(new Date((agentStatus.agent2 as Record<string, unknown>).run_at as string), { addSuffix: true })}
          </div>
        )}
      </div>

      {/* Agent status bar */}
      {agentStatus.agent1 && (
        <div className="px-4 py-2 bg-green-500/5 border-b border-green-500/10 flex gap-4 text-xs text-gray-400">
          <span>Agent 1: <span className="text-white">{String((agentStatus.agent1 as Record<string, unknown>).tickers_scanned || 0)}</span> tickers scanned</span>
          <span>·</span>
          <span><span className="text-green-400">{String((agentStatus.agent1 as Record<string, unknown>).catalysts_found || 0)}</span> catalysts found</span>
          <span>·</span>
          <span><span className="text-yellow-400">{String((agentStatus.agent1 as Record<string, unknown>).high_importance || 0)}</span> high-importance events</span>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="px-4 py-8 flex flex-col gap-3">
          {[1,2,3,4].map(i => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-10 h-10 rounded-xl bg-white/5" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-white/5 rounded w-1/3" />
                <div className="h-1.5 bg-white/5 rounded" />
              </div>
              <div className="w-12 space-y-1">
                <div className="h-3 bg-white/5 rounded" />
                <div className="h-2 bg-white/5 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <Bot size={32} className="text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm font-medium">Agents are warming up</p>
          <p className="text-gray-600 text-xs mt-1">Recommendations appear after the first agent run (every 6 hours)</p>
        </div>
      ) : (
        <div>
          {sorted.map(reco => (
            <div key={reco.ticker}>
              <RecoRow reco={reco} onClick={() => setSelected(selected === reco.ticker ? null : reco.ticker)} />
              {selected === reco.ticker && (
                <RecoDetail reco={reco} onClose={() => setSelected(null)} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
