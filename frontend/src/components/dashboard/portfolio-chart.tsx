'use client';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { authFetch } from '@/lib/api';
import { TrendingUp, TrendingDown } from 'lucide-react';

type Period = '1W' | '1M' | '3M' | '1Y';
const PERIODS: Period[] = ['1W', '1M', '3M', '1Y'];

interface Point { time: number; value: number; }
interface XY     { x: number; y: number; }

const PAD = { t: 28, b: 44, l: 8, r: 80 };

function scale(pts: Point[], W: number, H: number): XY[] {
  if (pts.length < 2) return [];
  const minT = pts[0].time, maxT = pts[pts.length - 1].time;
  const vals = pts.map(p => p.value);
  const minV = Math.min(...vals), maxV = Math.max(...vals);
  const rngV = maxV - minV || 1, rngT = maxT - minT || 1;
  const pw = W - PAD.l - PAD.r, ph = H - PAD.t - PAD.b;
  return pts.map(p => ({
    x: PAD.l + ((p.time - minT) / rngT) * pw,
    y: PAD.t + (1 - (p.value - minV) / rngV) * ph,
  }));
}

function smoothPath(xy: XY[]): string {
  if (xy.length < 2) return '';
  let d = `M${xy[0].x.toFixed(1)},${xy[0].y.toFixed(1)}`;
  for (let i = 1; i < xy.length - 1; i++) {
    const mx = ((xy[i].x + xy[i+1].x)/2).toFixed(1);
    const my = ((xy[i].y + xy[i+1].y)/2).toFixed(1);
    d += ` Q${xy[i].x.toFixed(1)},${xy[i].y.toFixed(1)} ${mx},${my}`;
  }
  return d + ` L${xy[xy.length-1].x.toFixed(1)},${xy[xy.length-1].y.toFixed(1)}`;
}

function nearestIdx(xy: XY[], x: number): number {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < xy.length; i++) {
    const d = Math.abs(xy[i].x - x);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

function fmtDate(ts: number, period: Period): string {
  const d = new Date(ts * 1000);
  if (period === '1W') return d.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' });
  if (period === '1Y') return d.toLocaleDateString('en-US', { month:'short', year:'2-digit' });
  return d.toLocaleDateString('en-US', { month:'short', day:'numeric' });
}

function priceTicks(pts: Point[], H: number, n = 5) {
  if (!pts.length) return [];
  const vals = pts.map(p => p.value);
  const minV = Math.min(...vals), maxV = Math.max(...vals);
  const ph = H - PAD.t - PAD.b;
  return Array.from({ length: n }, (_, i) => {
    const pct   = (i + 1) / (n + 1);
    const val   = minV + pct * (maxV - minV);
    const y     = PAD.t + (1 - pct) * ph;
    return { y, label: val >= 1000 ? `$${(val/1000).toFixed(1)}k` : `$${val.toFixed(0)}` };
  });
}

function timeTicks(pts: Point[], xy: XY[], period: Period, n = 4) {
  if (!pts.length || !xy.length) return [];
  const step = Math.floor(pts.length / (n + 1));
  return Array.from({ length: n }, (_, i) => {
    const idx = Math.min(step * (i + 1), pts.length - 1);
    if (!xy[idx]) return null;
    return { x: xy[idx].x, label: fmtDate(pts[idx].time, period) };
  }).filter(Boolean) as { x: number; label: string }[];
}

export function PortfolioChart() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<SVGPathElement>(null);
  const [W, setW]           = useState(0);
  const H                   = 260;
  const [period, setPeriod] = useState<Period>('1M');
  const [data,   setData]   = useState<Point[]>([]);
  const [loading,setLoad]   = useState(true);
  const [pathLen,setLen]    = useState(0);
  const [drawn,  setDrawn]  = useState(false);
  const [hoverIdx,setHov]   = useState<number | null>(null);

  useEffect(() => {
    if (!wrapRef.current) return;
    setW(wrapRef.current.clientWidth);
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const load = useCallback(async (p: Period, silent = false) => {
    if (!silent) setLoad(true);
    setHov(null);
    try {
      const res = await authFetch(`/api/portfolio/chart?period=${p}`);
      if (res.ok) {
        const d = await res.json();
        setData(Array.isArray(d) ? d : []);
      }
    } finally { setLoad(false); }
  }, []);

  useEffect(() => { load(period); }, [period, load]);

  const xy      = useMemo(() => W > 0 ? scale(data, W, H) : [], [data, W, H]);
  const lPath   = useMemo(() => smoothPath(xy), [xy]);
  const aPath   = useMemo(() => {
    if (!lPath || !xy.length) return '';
    return `${lPath} L${xy[xy.length-1].x},${H - PAD.b} L${xy[0].x},${H - PAD.b} Z`;
  }, [lPath, xy, H]);
  const pTicks  = useMemo(() => priceTicks(data, H), [data, H]);
  const tTicks  = useMemo(() => timeTicks(data, xy, period), [data, xy, period]);

  const positive = useMemo(() =>
    data.length >= 2 ? data[data.length-1].value >= data[0].value : true, [data]
  );
  const color  = positive ? '#22c55e' : '#ef4444';

  useEffect(() => {
    if (!lineRef.current || !lPath) return;
    const len = lineRef.current.getTotalLength();
    setLen(len); setDrawn(false);
    const t = requestAnimationFrame(() => setTimeout(() => setDrawn(true), 40));
    return () => cancelAnimationFrame(t);
  }, [lPath]);

  const onMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!xy.length) return;
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    setHov(nearestIdx(xy, e.clientX - rect.left));
  }, [xy]);

  // Summary numbers
  const firstVal  = data[0]?.value ?? 0;
  const lastVal   = data[data.length-1]?.value ?? 0;
  const hoverVal  = hoverIdx !== null ? data[hoverIdx]?.value : null;
  const dispVal   = hoverVal ?? lastVal;
  const diffVal   = dispVal - firstVal;
  const diffPct   = firstVal > 0 ? (diffVal / firstVal) * 100 : 0;
  const hoverXY   = hoverIdx !== null ? xy[hoverIdx] : null;
  const hoverPt   = hoverIdx !== null ? data[hoverIdx] : null;

  const gradId = 'portfolio-grad';
  const clipId = 'portfolio-clip';

  return (
    <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between px-6 pt-5 pb-2">
        <div>
          <div className="text-xs text-gray-500 font-medium mb-1 uppercase tracking-wide">Portfolio Value</div>
          <div className="text-3xl font-bold text-white tracking-tight">
            {loading ? <div className="h-9 w-36 bg-white/5 rounded-lg animate-pulse" /> : `$${dispVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </div>
          {!loading && data.length > 0 && (
            <div className={`flex items-center gap-1.5 mt-1 text-sm font-medium ${diffVal >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {diffVal >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              <span>{diffVal >= 0 ? '+' : ''}${Math.abs(diffVal).toFixed(2)}</span>
              <span className="opacity-70">({diffPct >= 0 ? '+' : ''}{diffPct.toFixed(2)}%)</span>
              {hoverPt && (
                <span className="text-gray-500 font-normal text-xs ml-1">{fmtDate(hoverPt.time, period)}</span>
              )}
            </div>
          )}
        </div>

        {/* Period selector */}
        <div className="flex gap-0.5 bg-white/5 rounded-xl p-1 mt-1">
          {PERIODS.map(p => (
            <button key={p} onClick={() => setPeriod(p)} disabled={loading}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40 ${
                period === p ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-200'
              }`}
            >{p}</button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div ref={wrapRef} className="relative w-full">
        {loading ? (
          <div className="flex items-end gap-1 px-6 pb-4" style={{ height: H }}>
            {Array.from({ length: 24 }, (_, i) => (
              <div key={i} className="flex-1 bg-white/5 rounded-t animate-pulse"
                style={{ height: `${35 + Math.sin(i * 0.6) * 18 + Math.cos(i * 0.3) * 12}%` }} />
            ))}
          </div>
        ) : W > 0 && data.length < 2 ? (
          <div className="flex flex-col items-center justify-center text-center px-6" style={{ height: H }}>
            <div className="text-3xl mb-3">📈</div>
            <p className="text-gray-400 text-sm font-medium">No portfolio history yet</p>
            <p className="text-gray-600 text-xs mt-1">Add trades in the Portfolio page to see your returns chart</p>
          </div>
        ) : W > 0 && (
          <svg width={W} height={H}
            onMouseMove={onMove} onMouseLeave={() => setHov(null)}
            className="cursor-crosshair block">
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={color} stopOpacity="0.22" />
                <stop offset="100%" stopColor={color} stopOpacity="0"    />
              </linearGradient>
              <clipPath id={clipId}>
                <rect x={PAD.l} y={PAD.t} width={W - PAD.l - PAD.r} height={H - PAD.t - PAD.b} />
              </clipPath>
            </defs>

            {/* Grid */}
            {pTicks.map((pt, i) => (
              <line key={i} x1={PAD.l} x2={W - PAD.r} y1={pt.y} y2={pt.y}
                stroke="#1c1c1c" strokeWidth="1" />
            ))}

            {/* Fill */}
            <path d={aPath} fill={`url(#${gradId})`} clipPath={`url(#${clipId})`} />

            {/* Line */}
            <path ref={lineRef} d={lPath} fill="none" stroke={color} strokeWidth="2"
              strokeLinecap="round" clipPath={`url(#${clipId})`}
              style={pathLen > 0 ? {
                strokeDasharray: pathLen,
                strokeDashoffset: drawn ? 0 : pathLen,
                transition: drawn ? `stroke-dashoffset ${Math.min(data.length * 8, 1200)}ms cubic-bezier(0.25,0.1,0.25,1)` : 'none',
              } : {}}
            />

            {/* Price axis */}
            {pTicks.map((pt, i) => (
              <text key={i} x={W - PAD.r + 8} y={pt.y + 4}
                fill="#374151" fontSize="11" fontFamily="monospace">{pt.label}</text>
            ))}

            {/* Time axis */}
            {tTicks.map((tt, i) => (
              <text key={i} x={tt.x} y={H - 12}
                fill="#374151" fontSize="11" textAnchor="middle" fontFamily="system-ui">{tt.label}</text>
            ))}

            {/* Crosshair */}
            {hoverXY && hoverPt && (
              <g>
                <line x1={hoverXY.x} x2={hoverXY.x} y1={PAD.t} y2={H - PAD.b}
                  stroke="#374151" strokeWidth="1" strokeDasharray="4 3" />
                <line x1={PAD.l} x2={W - PAD.r} y1={hoverXY.y} y2={hoverXY.y}
                  stroke="#374151" strokeWidth="1" strokeDasharray="4 3" />
                <circle cx={hoverXY.x} cy={hoverXY.y} r="5"
                  fill={color} stroke="#0a0a0a" strokeWidth="2" />
                {/* Value pill */}
                <rect x={W - PAD.r + 4} y={hoverXY.y - 12} width={PAD.r - 8} height={22}
                  rx={5} fill="#1a1a1a" stroke={color} strokeWidth="1" strokeOpacity="0.5" />
                <text x={W - PAD.r / 2} y={hoverXY.y + 4}
                  fill={color} fontSize="10" textAnchor="middle"
                  fontFamily="monospace" fontWeight="600">
                  ${hoverPt.value >= 1000 ? (hoverPt.value/1000).toFixed(1)+'k' : hoverPt.value.toFixed(0)}
                </text>
              </g>
            )}
          </svg>
        )}
      </div>
    </div>
  );
}
