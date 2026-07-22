'use client';

import { useEffect, useState, useCallback } from 'react';
import { Topbar } from '@/components/layout/topbar';
import { motion } from 'framer-motion';
import {
  Zap, TrendingUp, TrendingDown, Target, ShieldAlert, Clock,
  CheckCircle, XCircle, Minus, RefreshCw, Activity, Square, Play,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Position {
  id: string; ticker: string; action: string; entry_price: number;
  current_price: number; shares: number; trade_amount: number;
  stop_loss_price: number; take_profit_price: number;
  pnl: string; pnl_pct: string; opened_at: string;
  paper_trade: boolean; confidence: number; judge_reasoning: string;
}

interface Signal {
  id: string; ticker: string; action: string; confidence: number;
  entry_price: number; take_profit_pct: number; stop_loss_pct: number;
  judge_reasoning: string; risk_status: string; reject_reason: string;
  created_at: string;
}

interface AccuracyOverall {
  total_trades: string; wins: string; losses: string;
  win_rate_pct: string; avg_return_pct: string;
  take_profits_hit: string; stop_losses_hit: string;
}

interface PipelineRun {
  id: string; run_at: string; duration_ms: number;
  tickers_scanned: number; signals_found: number;
  trades_executed: number; status: string;
}

interface WatchlistTicker {
  ticker: string; name: string; sector: string;
  beta: number; last_price: number; in_position: string;
}

// ── Sub-components ──────────────────────────────────────────────────────────────

function PipelineStatus({ runs }: { runs: PipelineRun[] }) {
  const last = runs[0];
  if (!last) return (
    <div className="text-gray-500 text-sm">No pipeline runs yet. Start the orchestrator.</div>
  );

  return (
    <div className="flex items-center gap-6 flex-wrap">
      <div className="flex items-center gap-2">
        <div className={cn('w-2 h-2 rounded-full animate-pulse',
          last.status === 'completed' ? 'bg-green-400' :
          last.status === 'running'   ? 'bg-yellow-400' : 'bg-red-400'
        )} />
        <span className="text-sm text-white font-medium capitalize">{last.status}</span>
      </div>
      <div className="text-sm text-gray-400">
        Last run: <span className="text-white">{new Date(last.run_at).toLocaleTimeString()}</span>
      </div>
      <div className="text-sm text-gray-400">
        Scanned: <span className="text-white">{last.tickers_scanned}</span> tickers
      </div>
      <div className="text-sm text-gray-400">
        Signals: <span className="text-white">{last.signals_found}</span>
      </div>
      <div className="text-sm text-gray-400">
        Trades: <span className="text-white">{last.trades_executed}</span>
      </div>
      <div className="text-sm text-gray-400">
        Duration: <span className="text-white">{((last.duration_ms || 0) / 1000).toFixed(1)}s</span>
      </div>
    </div>
  );
}

function PositionCard({ pos }: { pos: Position }) {
  const pnl = parseFloat(pos.pnl);
  const pnlPct = parseFloat(pos.pnl_pct);
  const positive = pnl >= 0;

  const slDist = ((pos.current_price - pos.stop_loss_price) / pos.entry_price * 100).toFixed(1);
  const tpDist = ((pos.take_profit_price - pos.current_price) / pos.entry_price * 100).toFixed(1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-5 space-y-4"
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-white font-bold text-lg">{pos.ticker}</span>
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-semibold',
              pos.action === 'BUY' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            )}>{pos.action}</span>
            {pos.paper_trade && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-semibold">PAPER</span>
            )}
          </div>
          <div className="text-gray-400 text-xs mt-1">
            {pos.shares.toFixed(2)} shares · Entry ${ Number(pos.entry_price).toFixed(2)}
          </div>
        </div>
        <div className="text-right">
          <div className={cn('text-lg font-bold', positive ? 'text-green-400' : 'text-red-400')}>
            {positive ? '+' : ''}{pnlPct}%
          </div>
          <div className={cn('text-sm', positive ? 'text-green-400/70' : 'text-red-400/70')}>
            {positive ? '+' : ''}${pnl.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="text-sm text-white font-medium">
        ${Number(pos.current_price).toFixed(2)}
      </div>

      {/* SL / TP progress bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-gray-500">
          <span className="flex items-center gap-1"><ShieldAlert size={11} /> SL ${Number(pos.stop_loss_price).toFixed(2)} ({slDist}%)</span>
          <span className="flex items-center gap-1"><Target size={11} /> TP ${Number(pos.take_profit_price).toFixed(2)} (+{tpDist}%)</span>
        </div>
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', positive ? 'bg-green-500' : 'bg-red-500')}
            style={{
              width: `${Math.min(100, Math.max(0,
                (pos.current_price - pos.stop_loss_price) /
                (pos.take_profit_price - pos.stop_loss_price) * 100
              ))}%`
            }}
          />
        </div>
      </div>

      {pos.judge_reasoning && (
        <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{pos.judge_reasoning}</p>
      )}

      <div className="text-xs text-gray-600">
        Opened {new Date(pos.opened_at).toLocaleString()} · {pos.confidence}% confidence
      </div>
    </motion.div>
  );
}

function EmptySlot({ slot }: { slot: number }) {
  return (
    <div className="bg-[#1a1a1a] border border-dashed border-white/10 rounded-2xl p-5 flex flex-col items-center justify-center gap-2 min-h-[180px]">
      <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center">
        <span className="text-gray-600 text-sm font-bold">{slot}</span>
      </div>
      <span className="text-gray-600 text-sm">Empty slot</span>
    </div>
  );
}

function SignalRow({ sig }: { sig: Signal }) {
  const approved = sig.risk_status === 'approved';
  const action = sig.action;

  return (
    <tr className="border-b border-white/5 hover:bg-white/3 transition-colors">
      <td className="py-3 px-4">
        <span className="text-white font-semibold">{sig.ticker}</span>
      </td>
      <td className="py-3 px-4">
        <span className={cn('text-xs px-2 py-0.5 rounded-full font-bold',
          action === 'BUY'   ? 'bg-green-500/20 text-green-400' :
          action === 'SHORT' ? 'bg-red-500/20 text-red-400' :
          action === 'SKIP'  ? 'bg-gray-500/20 text-gray-400' :
                               'bg-yellow-500/20 text-yellow-400'
        )}>{action}</span>
      </td>
      <td className="py-3 px-4 text-sm text-gray-300">{sig.confidence}%</td>
      <td className="py-3 px-4 text-sm text-gray-300">${Number(sig.entry_price).toFixed(2)}</td>
      <td className="py-3 px-4 text-sm text-green-400">+{Number(sig.take_profit_pct).toFixed(1)}%</td>
      <td className="py-3 px-4 text-sm text-red-400">-{Number(sig.stop_loss_pct).toFixed(1)}%</td>
      <td className="py-3 px-4">
        {approved
          ? <CheckCircle size={14} className="text-green-400" />
          : sig.risk_status === 'rejected'
            ? <XCircle size={14} className="text-red-400" />
            : <Minus size={14} className="text-gray-500" />
        }
        {sig.reject_reason && (
          <span className="text-xs text-gray-600 ml-1">{sig.reject_reason.replace(/_/g, ' ')}</span>
        )}
      </td>
      <td className="py-3 px-4 text-xs text-gray-600">
        {new Date(sig.created_at).toLocaleTimeString()}
      </td>
    </tr>
  );
}

// ── Progress Ring ──────────────────────────────────────────────────────────────

function ProgressRing({ pct, stage, status }: { pct: number; stage: string; status: string }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;

  const color =
    status === 'failed'    ? '#ef4444' :
    status === 'completed' ? '#22c55e' :
    status === 'running'   ? '#22c55e' : '#4b5563';

  return (
    <div className="flex items-center gap-3">
      <div className="relative w-14 h-14 flex-shrink-0">
        <svg className="-rotate-90 w-14 h-14" viewBox="0 0 56 56">
          <circle cx="28" cy="28" r={r} strokeWidth="3.5"
            stroke="rgba(255,255,255,0.06)" fill="none" />
          <circle cx="28" cy="28" r={r} strokeWidth="3.5"
            stroke={color} fill="none"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold text-white">{pct}%</span>
        </div>
      </div>
      <div className="min-w-0">
        <div className="text-xs font-semibold text-white capitalize">
          {status === 'idle' ? 'Idle' : status === 'completed' ? 'Complete' : status === 'failed' ? 'Failed' : 'Running'}
        </div>
        <div className="text-[11px] text-gray-500 truncate max-w-[140px]" title={stage}>{stage}</div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AutoTraderPage() {
  const [positions, setPositions]   = useState<Position[]>([]);
  const [signals, setSignals]       = useState<Signal[]>([]);
  const [accuracy, setAccuracy]     = useState<{ overall: AccuracyOverall } | null>(null);
  const [pipeline, setPipeline]     = useState<PipelineRun[]>([]);
  const [watchlist, setWatchlist]   = useState<WatchlistTicker[]>([]);
  const [loading, setLoading]       = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [agentRunning, setAgentRunning] = useState(false);
  const [agentPid, setAgentPid]     = useState<number | null>(null);
  const [controlling, setControlling] = useState(false);
  const [controlError, setControlError] = useState<string | null>(null);
  const [progress, setProgress]     = useState(0);
  const [progressStage, setProgressStage] = useState('Idle');
  const [progressStatus, setProgressStatus] = useState('idle');

  const checkAgentStatus = useCallback(async () => {
    try {
      const r = await fetch('/api/trading/control');
      const d = await r.json();
      setAgentRunning(d.running);
      setAgentPid(d.pid ?? null);
    } catch {}
  }, []);

  const checkProgress = useCallback(async () => {
    try {
      const r = await fetch('/api/trading/progress');
      const d = await r.json();
      setProgress(d.progress ?? 0);
      setProgressStage(d.stage ?? 'Idle');
      setProgressStatus(d.status ?? 'idle');
    } catch {}
  }, []);

  const toggleAgent = useCallback(async () => {
    setControlling(true);
    setControlError(null);
    try {
      const action = agentRunning ? 'stop' : 'start';
      const r = await fetch('/api/trading/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const d = await r.json();
      if (d.error) {
        setControlError(d.error);
      } else {
        setAgentRunning(d.running);
        setAgentPid(d.pid ?? null);
      }
    } catch (e) {
      setControlError(e instanceof Error ? e.message : 'Request failed');
    }
    setControlling(false);
  }, [agentRunning]);

  const fetchAll = useCallback(async () => {
    const [pos, sig, acc, pip, wl] = await Promise.allSettled([
      fetch('/api/trading/positions').then(r => r.json()),
      fetch('/api/trading/signals?limit=30').then(r => r.json()),
      fetch('/api/trading/accuracy').then(r => r.json()),
      fetch('/api/trading/pipeline').then(r => r.json()),
      fetch('/api/trading/watchlist').then(r => r.json()),
    ]);

    if (pos.status === 'fulfilled' && Array.isArray(pos.value)) setPositions(pos.value);
    if (sig.status === 'fulfilled' && Array.isArray(sig.value)) setSignals(sig.value);
    if (acc.status === 'fulfilled') setAccuracy(acc.value);
    if (pip.status === 'fulfilled' && Array.isArray(pip.value)) setPipeline(pip.value);
    if (wl.status  === 'fulfilled' && Array.isArray(wl.value))  setWatchlist(wl.value);
    setLastRefresh(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    checkAgentStatus();
    checkProgress();
    const dataInterval     = setInterval(fetchAll, 60000);
    const statusInterval   = setInterval(checkAgentStatus, 3000);
    const progressInterval = setInterval(checkProgress, 3000);
    return () => {
      clearInterval(dataInterval);
      clearInterval(statusInterval);
      clearInterval(progressInterval);
    };
  }, [fetchAll, checkAgentStatus, checkProgress]);

  const ov = accuracy?.overall;
  const winRate = parseFloat(ov?.win_rate_pct || '0');

  return (
    <div className="flex flex-col flex-1">
      <Topbar title="Auto Trader" />
      <main className="flex-1 p-6 space-y-6">

        {/* ── Header bar ───────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-green-500/20 flex items-center justify-center">
              <Zap size={18} className="text-green-400" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg leading-none">Auto Trader</h2>
              <p className="text-gray-500 text-xs mt-0.5">Paper trading · 8-agent pipeline · 10-min loop</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Pipeline progress ring */}
            <ProgressRing pct={progress} stage={progressStage} status={progressStatus} />

            <div className="w-px h-10 bg-white/10" />

            {/* Agent status badge */}
            <div className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border',
              agentRunning
                ? 'bg-green-500/10 border-green-500/30 text-green-400'
                : 'bg-white/5 border-white/10 text-gray-500'
            )}>
              <span className={cn(
                'w-1.5 h-1.5 rounded-full',
                agentRunning ? 'bg-green-400 animate-pulse' : 'bg-gray-600'
              )} />
              {agentRunning ? `Running${agentPid ? ` · PID ${agentPid}` : ''}` : 'Stopped'}
            </div>

            {/* Start / Stop button */}
            <button
              onClick={toggleAgent}
              disabled={controlling}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed',
                agentRunning
                  ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30'
                  : 'bg-green-500 text-black hover:bg-green-400'
              )}
            >
              {controlling ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : agentRunning ? (
                <Square size={14} />
              ) : (
                <Play size={14} />
              )}
              {controlling ? 'Working…' : agentRunning ? 'Stop Agents' : 'Start Agents'}
            </button>

            {/* Data refresh */}
            <button
              onClick={fetchAll}
              className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-white/5"
            >
              <RefreshCw size={13} />
              {lastRefresh ? lastRefresh.toLocaleTimeString() : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Error banner */}
        {controlError && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5 text-sm text-red-400">
            <XCircle size={14} />
            <span>Agent error: {controlError}</span>
            <button onClick={() => setControlError(null)} className="ml-auto text-red-400/60 hover:text-red-400">✕</button>
          </div>
        )}

        {/* ── Pipeline status ───────────────────────────── */}
        <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity size={14} className="text-gray-400" />
            <span className="text-sm font-medium text-gray-300">Pipeline Status</span>
          </div>
          <PipelineStatus runs={pipeline} />
        </div>

        {/* ── Stats row ─────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Open Positions', value: `${positions.length} / 3`, icon: Zap, color: 'text-green-400' },
            { label: 'Win Rate', value: ov ? `${winRate}%` : '—',
              icon: winRate >= 70 ? TrendingUp : TrendingDown,
              color: winRate >= 70 ? 'text-green-400' : winRate > 0 ? 'text-yellow-400' : 'text-gray-400' },
            { label: 'Total Trades', value: ov?.total_trades || '0', icon: Target, color: 'text-blue-400' },
            { label: 'Avg Return', value: ov ? `${ov.avg_return_pct}%` : '—', icon: Activity, color: 'text-purple-400' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon size={14} className={color} />
                <span className="text-xs text-gray-500">{label}</span>
              </div>
              <div className={cn('text-2xl font-bold', color)}>{value}</div>
            </div>
          ))}
        </div>

        {/* ── Open Positions (3 slots) ──────────────────── */}
        <section>
          <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wide">
            Open Positions ({positions.length}/3)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {positions.map(pos => <PositionCard key={pos.id} pos={pos} />)}
            {Array.from({ length: Math.max(0, 3 - positions.length) }).map((_, i) => (
              <EmptySlot key={i} slot={positions.length + i + 1} />
            ))}
          </div>
        </section>

        {/* ── Signal Feed ───────────────────────────────── */}
        <section>
          <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wide">
            Recent Signals
          </h3>
          {loading ? (
            <div className="text-gray-500 text-sm text-center py-8">Loading signals...</div>
          ) : signals.length === 0 ? (
            <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-8 text-center text-gray-500 text-sm">
              No signals yet. Start the orchestrator to begin the pipeline.
            </div>
          ) : (
            <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-gray-500 text-xs uppercase tracking-wide">
                    <th className="text-left py-3 px-4">Ticker</th>
                    <th className="text-left py-3 px-4">Action</th>
                    <th className="text-left py-3 px-4">Conf.</th>
                    <th className="text-left py-3 px-4">Entry</th>
                    <th className="text-left py-3 px-4">Take Profit</th>
                    <th className="text-left py-3 px-4">Stop Loss</th>
                    <th className="text-left py-3 px-4">Risk</th>
                    <th className="text-left py-3 px-4">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {signals.map(s => <SignalRow key={s.id} sig={s} />)}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Trading Watchlist ─────────────────────────── */}
        <section>
          <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wide">
            Trading Watchlist ({watchlist.length} tickers)
          </h3>
          {watchlist.length === 0 ? (
            <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-6 text-center text-gray-500 text-sm">
              Run <code className="text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">npm run refresh-watchlist</code> to auto-select top 30 high-volatility tickers.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-2">
              {watchlist.map(t => (
                <div key={t.ticker} className={cn(
                  'bg-[#1a1a1a] border rounded-xl p-3 text-center transition-colors',
                  t.in_position !== '0' ? 'border-green-500/30 bg-green-500/5' : 'border-white/5'
                )}>
                  <div className="text-white font-bold text-sm">{t.ticker}</div>
                  <div className="text-gray-500 text-xs mt-0.5">β {Number(t.beta || 0).toFixed(2)}</div>
                  {t.last_price ? (
                    <div className="text-gray-400 text-xs">${Number(t.last_price).toFixed(2)}</div>
                  ) : null}
                  {t.in_position !== '0' && (
                    <div className="text-green-400 text-[10px] mt-1 font-semibold">IN POSITION</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Accuracy Stats ────────────────────────────── */}
        {ov && parseInt(ov.total_trades) > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wide">
              Accuracy Tracker
            </h3>
            <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-sm text-gray-300">{ov.wins} wins</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-sm text-gray-300">{ov.losses} losses</span>
                </div>
                <div className="flex items-center gap-2">
                  <Target size={12} className="text-green-400" />
                  <span className="text-sm text-gray-300">{ov.take_profits_hit} take-profits hit</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldAlert size={12} className="text-red-400" />
                  <span className="text-sm text-gray-300">{ov.stop_losses_hit} stop-losses hit</span>
                </div>
              </div>

              {/* Win rate bar */}
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Win rate</span>
                  <span className={cn(winRate >= 70 ? 'text-green-400' : 'text-yellow-400', 'font-semibold')}>
                    {winRate}% {winRate >= 70 ? '✓ Ready for live trading' : `(need 70%)`}
                  </span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500',
                      winRate >= 70 ? 'bg-green-500' : 'bg-yellow-500'
                    )}
                    style={{ width: `${Math.min(100, winRate)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                  <span>0%</span>
                  <span className="text-green-600">70% threshold</span>
                  <span>100%</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── How to run ───────────────────────────────── */}
        <section>
          <div className="bg-[#111] border border-white/5 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Clock size={14} className="text-gray-400" />
              <span className="text-sm font-medium text-gray-300">How to run the pipeline</span>
            </div>
            <div className="space-y-1.5 font-mono text-xs">
              <div><span className="text-gray-600"># 1. Set up DB tables</span></div>
              <div><code className="text-green-400">cd stocks-app/db-setup && node trading-schema.js</code></div>
              <div className="mt-2"><span className="text-gray-600"># 2. Seed the trading watchlist</span></div>
              <div><code className="text-green-400">cd stocks-app/backend/trading-agents && npm install && npm run refresh-watchlist</code></div>
              <div className="mt-2"><span className="text-gray-600"># 3. Start the orchestrator (runs every 10 min during market hours)</span></div>
              <div><code className="text-green-400">npm start</code></div>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
