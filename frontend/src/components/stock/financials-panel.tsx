'use client';
import { motion } from 'framer-motion';

interface Metrics {
  pe: number | null; pb: number | null; eps: number | null;
  roe: number | null; roa: number | null; netMargin: number | null;
  grossMargin: number | null; beta: number | null;
  week52High: number | null; week52Low: number | null;
  week52Return: number | null; dividendYield: number | null;
  debtEquity: number | null; currentRatio: number | null;
}

interface Profile {
  marketCap: number; shares: number; employees: number | null;
  ipo: string; name: string; ticker: string;
}

const n  = (v: number | null, d = 2, suf = '') => v != null ? `${v.toFixed(d)}${suf}` : '—';
const np = (v: number | null) => v != null ? `${(v * 100).toFixed(1)}%` : '—';
const nd = (v: number | null) => v != null ? `${v.toFixed(2)}%` : '—';

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
      <span className="text-sm text-gray-400">{label}</span>
      <span className={`text-sm font-medium ${color || 'text-white'}`}>{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/3 border border-white/5 rounded-2xl p-4">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{title}</h4>
      {children}
    </div>
  );
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(Math.abs(value) / max * 100, 100);
  return (
    <div className="mt-1 h-1 bg-white/5 rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }} animate={{ width: `${pct}%` }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className={`h-full rounded-full ${color}`}
      />
    </div>
  );
}

function ReturnCard({ label, value, isPositive }: { label: string; value: string; isPositive: boolean }) {
  return (
    <div className="bg-white/3 border border-white/5 rounded-xl p-3 text-center">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-lg font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>{value}</div>
    </div>
  );
}

export function FinancialsPanel({ metrics, profile }: { metrics: Metrics; profile: Profile }) {
  const marketCapB = profile.marketCap > 0
    ? profile.marketCap >= 1000
      ? `$${(profile.marketCap / 1000).toFixed(1)}T`
      : `$${profile.marketCap.toFixed(1)}B`
    : '—';

  const w52Ret = metrics.week52Return;
  const gmPct  = metrics.grossMargin ? metrics.grossMargin * 100 : null;
  const nmPct  = metrics.netMargin   ? metrics.netMargin   * 100 : null;
  const roePct = metrics.roe         ? metrics.roe         * 100 : null;
  const roaPct = metrics.roa         ? metrics.roa         * 100 : null;

  return (
    <div className="space-y-4">
      {/* 52-week performance */}
      <div className="bg-[#111] border border-white/5 rounded-2xl p-5">
        <h3 className="font-semibold text-white mb-4">52-Week Performance</h3>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <ReturnCard
            label="52W Return"
            value={w52Ret != null ? `${w52Ret >= 0 ? '+' : ''}${w52Ret.toFixed(1)}%` : '—'}
            isPositive={(w52Ret ?? 0) >= 0}
          />
          <ReturnCard
            label="52W High"
            value={metrics.week52High ? `$${metrics.week52High.toFixed(2)}` : '—'}
            isPositive={true}
          />
          <ReturnCard
            label="52W Low"
            value={metrics.week52Low ? `$${metrics.week52Low.toFixed(2)}` : '—'}
            isPositive={false}
          />
        </div>

        {/* 52W range bar */}
        {metrics.week52High && metrics.week52Low && (
          <div className="bg-white/3 rounded-xl p-4">
            <div className="flex justify-between text-xs text-gray-500 mb-2">
              <span>52W Low  ${metrics.week52Low.toFixed(2)}</span>
              <span>52W High  ${metrics.week52High.toFixed(2)}</span>
            </div>
            <div className="relative h-2 bg-white/10 rounded-full">
              <div
                className="absolute h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-full"
                style={{ width: '100%', opacity: 0.4 }}
              />
              {/* Position marker - we'd need current price for this but use week52Return as proxy */}
            </div>
            <div className="text-xs text-gray-500 mt-2 text-center">
              {w52Ret != null && (w52Ret >= 0 ? `Up ${w52Ret.toFixed(1)}% from 52-week low` : `Down ${Math.abs(w52Ret).toFixed(1)}% from 52-week high`)}
            </div>
          </div>
        )}
      </div>

      {/* Financials grid */}
      <div className="bg-[#111] border border-white/5 rounded-2xl p-5">
        <h3 className="font-semibold text-white mb-4">Key Financials</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <Section title="Valuation">
            <Row label="P/E Ratio"      value={n(metrics.pe, 1, 'x')} />
            <Row label="P/B Ratio"      value={n(metrics.pb, 2, 'x')} />
            <Row label="EPS (TTM)"      value={metrics.eps != null ? `$${metrics.eps.toFixed(2)}` : '—'}
              color={metrics.eps != null && metrics.eps >= 0 ? 'text-green-400' : 'text-red-400'} />
            <Row label="Market Cap"     value={marketCapB} />
            <Row label="Dividend Yield" value={nd(metrics.dividendYield)}
              color={metrics.dividendYield ? 'text-green-400' : 'text-white'} />
          </Section>

          <Section title="Profitability">
            <div className="py-2.5 border-b border-white/5">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">Gross Margin</span>
                <span className={`font-medium ${gmPct != null && gmPct > 40 ? 'text-green-400' : gmPct != null && gmPct > 20 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {np(metrics.grossMargin)}
                </span>
              </div>
              {gmPct != null && <MiniBar value={gmPct} max={100} color="bg-green-400" />}
            </div>
            <div className="py-2.5 border-b border-white/5">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">Net Margin</span>
                <span className={`font-medium ${nmPct != null && nmPct > 15 ? 'text-green-400' : nmPct != null && nmPct > 5 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {np(metrics.netMargin)}
                </span>
              </div>
              {nmPct != null && <MiniBar value={nmPct} max={50} color={nmPct > 0 ? 'bg-green-400' : 'bg-red-400'} />}
            </div>
            <div className="py-2.5 border-b border-white/5">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">ROE</span>
                <span className={`font-medium ${roePct != null && roePct > 15 ? 'text-green-400' : 'text-yellow-400'}`}>
                  {np(metrics.roe)}
                </span>
              </div>
              {roePct != null && <MiniBar value={Math.abs(roePct)} max={50} color="bg-blue-400" />}
            </div>
            <div className="py-2.5">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">ROA</span>
                <span className={`font-medium ${roaPct != null && roaPct > 8 ? 'text-green-400' : 'text-yellow-400'}`}>
                  {np(metrics.roa)}
                </span>
              </div>
              {roaPct != null && <MiniBar value={Math.abs(roaPct)} max={30} color="bg-purple-400" />}
            </div>
          </Section>

          <Section title="Financial Strength">
            <Row label="Debt / Equity"  value={n(metrics.debtEquity, 2, 'x')}
              color={metrics.debtEquity != null ? metrics.debtEquity < 1 ? 'text-green-400' : metrics.debtEquity < 2 ? 'text-yellow-400' : 'text-red-400' : 'text-white'} />
            <Row label="Current Ratio"  value={n(metrics.currentRatio, 2, 'x')}
              color={metrics.currentRatio != null ? metrics.currentRatio > 1.5 ? 'text-green-400' : metrics.currentRatio > 1 ? 'text-yellow-400' : 'text-red-400' : 'text-white'} />
            <Row label="Beta"           value={n(metrics.beta, 2)} />
          </Section>

          <Section title="Company Info">
            <Row label="Employees"   value={profile.employees ? profile.employees.toLocaleString() : '—'} />
            <Row label="IPO Date"    value={profile.ipo || '—'} />
            <Row label="Shares Out." value={profile.shares ? `${(profile.shares / 1000).toFixed(1)}B` : '—'} />
          </Section>
        </div>
      </div>
    </div>
  );
}
