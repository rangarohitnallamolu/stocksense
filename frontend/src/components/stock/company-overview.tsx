'use client';
import { ExternalLink } from 'lucide-react';

interface Metrics {
  pe: number | null;
  pb: number | null;
  eps: number | null;
  roe: number | null;
  roa: number | null;
  netMargin: number | null;
  grossMargin: number | null;
  beta: number | null;
  week52High: number | null;
  week52Low: number | null;
  week52Return: number | null;
  dividendYield: number | null;
  debtEquity: number | null;
  currentRatio: number | null;
}

interface ProfileData {
  name: string;
  description: string;
  website: string;
  employees: number | null;
  ipo: string;
  country: string;
  marketCap: number;
  shares: number;
}

interface AiReco {
  recommendation: string;
  confidence_score: number;
  price_target_12m: number;
  upside_pct: number;
  reasoning: string;
}

function MetricRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
      <span className="text-sm text-gray-400">{label}</span>
      <span className={`text-sm font-medium ${color || 'text-white'}`}>{value}</span>
    </div>
  );
}

const fmt = (v: number | null, decimals = 2, suffix = '') =>
  v != null ? `${v.toFixed(decimals)}${suffix}` : '—';

const RECO_COLOR: Record<string, string> = {
  STRONG_BUY: 'text-emerald-400', BUY: 'text-green-400',
  HOLD: 'text-yellow-400', SELL: 'text-orange-400', STRONG_SELL: 'text-red-400',
};

export function CompanyOverview({
  profile, metrics, aiReco,
}: { profile: ProfileData; metrics: Metrics; aiReco: AiReco | null }) {
  const marketCapB = profile.marketCap ? `$${(profile.marketCap / 1000).toFixed(1)}B` : '—';

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

      {/* About */}
      <div className="xl:col-span-2 bg-[#111] border border-white/5 rounded-2xl p-5">
        <h3 className="font-semibold text-white mb-3">About</h3>
        <p className="text-sm text-gray-400 leading-relaxed mb-4 line-clamp-4">
          {profile.description || 'No description available.'}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Market Cap', value: marketCapB },
            { label: 'Employees',  value: profile.employees ? profile.employees.toLocaleString() : '—' },
            { label: 'IPO Date',   value: profile.ipo || '—' },
            { label: 'Country',    value: profile.country || '—' },
          ].map(s => (
            <div key={s.label} className="bg-white/5 rounded-xl p-3">
              <div className="text-xs text-gray-500 mb-1">{s.label}</div>
              <div className="text-sm font-medium text-white">{s.value}</div>
            </div>
          ))}
        </div>
        {profile.website && (
          <a href={profile.website} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-green-400 hover:text-green-300 mt-3 transition-colors">
            <ExternalLink size={12} /> {profile.website.replace(/^https?:\/\//, '')}
          </a>
        )}
      </div>

      {/* Key Metrics */}
      <div className="bg-[#111] border border-white/5 rounded-2xl p-5">
        <h3 className="font-semibold text-white mb-3">Key Metrics</h3>
        <MetricRow label="P/E Ratio"     value={fmt(metrics.pe, 1, 'x')} />
        <MetricRow label="P/B Ratio"     value={fmt(metrics.pb, 2, 'x')} />
        <MetricRow label="EPS (TTM)"     value={metrics.eps != null ? `$${metrics.eps.toFixed(2)}` : '—'} />
        <MetricRow label="ROE"           value={fmt(metrics.roe, 1, '%')} />
        <MetricRow label="Net Margin"    value={fmt(metrics.netMargin, 1, '%')} />
        <MetricRow label="Beta"          value={fmt(metrics.beta, 2)} />
        <MetricRow label="52W High"      value={metrics.week52High != null ? `$${metrics.week52High.toFixed(2)}` : '—'} color="text-green-400" />
        <MetricRow label="52W Low"       value={metrics.week52Low  != null ? `$${metrics.week52Low.toFixed(2)}`  : '—'} color="text-red-400"   />
        <MetricRow label="52W Return"    value={fmt(metrics.week52Return, 1, '%')}
          color={(metrics.week52Return ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'} />
        <MetricRow label="Dividend Yield" value={fmt(metrics.dividendYield, 2, '%')} />
      </div>

      {/* AI Recommendation snippet */}
      {aiReco && (
        <div className="xl:col-span-3 bg-[#111] border border-white/5 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">🤖 AI Recommendation</span>
              <span className="text-xs text-gray-500">— Agent 2 analysis</span>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-sm font-bold ${RECO_COLOR[aiReco.recommendation] || 'text-white'}`}>
                {aiReco.recommendation.replace('_', ' ')}
              </span>
              <span className="text-xs text-gray-400">
                {Number(aiReco.confidence_score)}% confidence
              </span>
              <span className="text-xs text-green-400 font-medium">
                ${Number(aiReco.price_target_12m).toFixed(2)} target
                ({Number(aiReco.upside_pct) > 0 ? '+' : ''}{Number(aiReco.upside_pct).toFixed(1)}%)
              </span>
            </div>
          </div>
          <p className="text-sm text-gray-400 leading-relaxed">{aiReco.reasoning}</p>
        </div>
      )}
    </div>
  );
}
