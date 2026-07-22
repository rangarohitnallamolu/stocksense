'use client';
import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';

type Period = '1D' | '1W' | '1M' | '3M' | '1Y';
interface Point { time: number; value: number; }
interface XY     { x: number; y: number; }

const PERIODS: Period[] = ['1D', '1W', '1M', '3M', '1Y'];
const PAD = { t: 24, b: 40, l: 8, r: 68 };

// ─── Math helpers ─────────────────────────────────────────────────────────────
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

function linePath(xy: XY[]): string {
  if (xy.length < 2) return '';
  let d = `M${xy[0].x.toFixed(1)},${xy[0].y.toFixed(1)}`;
  for (let i = 1; i < xy.length - 1; i++) {
    const mx = ((xy[i].x + xy[i + 1].x) / 2).toFixed(1);
    const my = ((xy[i].y + xy[i + 1].y) / 2).toFixed(1);
    d += ` Q${xy[i].x.toFixed(1)},${xy[i].y.toFixed(1)} ${mx},${my}`;
  }
  d += ` L${xy[xy.length - 1].x.toFixed(1)},${xy[xy.length - 1].y.toFixed(1)}`;
  return d;
}

function areaPath(xy: XY[], H: number): string {
  if (xy.length < 2) return '';
  const bottom = H - PAD.b;
  return `${linePath(xy)} L${xy[xy.length - 1].x.toFixed(1)},${bottom} L${xy[0].x.toFixed(1)},${bottom} Z`;
}

function nearestIdx(xy: XY[], mouseX: number): number {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < xy.length; i++) {
    const d = Math.abs(xy[i].x - mouseX);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

function priceTicks(pts: Point[], xy: XY[], H: number, n = 4) {
  if (!pts.length || !xy.length) return [];
  const vals = pts.map(p => p.value);
  const minV = Math.min(...vals), maxV = Math.max(...vals);
  const ph = H - PAD.t - PAD.b;
  return Array.from({ length: n }, (_, i) => {
    const pct   = (i + 1) / (n + 1);
    const price = minV + pct * (maxV - minV);
    const y     = PAD.t + (1 - pct) * ph;
    return { y, label: `$${price >= 1000 ? price.toFixed(0) : price.toFixed(2)}` };
  });
}

function timeTicks(pts: Point[], xy: XY[], period: Period, n = 4) {
  if (!pts.length || !xy.length) return [];
  const step = Math.floor(pts.length / (n + 1));
  return Array.from({ length: n }, (_, i) => {
    const idx = Math.min(step * (i + 1), pts.length - 1);
    if (!xy[idx]) return null;
    const d = new Date(pts[idx].time * 1000);
    const label = period === '1D'
      ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      : period === '1W'
      ? d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return { x: xy[idx].x, label };
  }).filter(Boolean) as { x: number; label: string }[];
}

// ─── Component ────────────────────────────────────────────────────────────────
interface Props {
  ticker:        string;
  initialPrice:  number;
  initialData:   Point[];
  initialPeriod: Period;
}

export function CustomChart({ ticker, initialPrice, initialData, initialPeriod }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<SVGPathElement>(null);

  const [W, setW]         = useState(0);
  const H                 = 300;
  const [period, setPer]  = useState<Period>(initialPeriod);
  const [data, setData]   = useState<Point[]>(initialData);
  const [loading, setLoad]= useState(false);
  const [pathLen, setLen] = useState(0);
  const [drawn, setDrawn] = useState(false);
  const [hoverIdx, setHov]= useState<number | null>(null);

  // Measure width once on mount
  useEffect(() => {
    if (!wrapRef.current) return;
    setW(wrapRef.current.clientWidth);
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const xy       = useMemo(() => (W > 0 ? scale(data, W, H)    : []), [data, W, H]);
  const lPath    = useMemo(() => linePath(xy),                            [xy]);
  const aPath    = useMemo(() => areaPath(xy, H),                         [xy, H]);
  const pTicks   = useMemo(() => priceTicks(data, xy, H),                 [data, xy, H]);
  const tTicks   = useMemo(() => timeTicks(data, xy, period),             [data, xy, period]);

  const positive = useMemo(() =>
    data.length >= 2 ? data[data.length - 1].value >= data[0].value : true,
    [data]
  );
  const color  = positive ? '#22c55e' : '#ef4444';
  const fadeC  = positive ? 'rgba(34,197,94,0.18)' : 'rgba(239,68,68,0.15)';

  // Animate line draw whenever path changes
  useEffect(() => {
    if (!lineRef.current || !lPath) return;
    const len = lineRef.current.getTotalLength();
    setLen(len);
    setDrawn(false);
    const t = requestAnimationFrame(() => setTimeout(() => setDrawn(true), 30));
    return () => cancelAnimationFrame(t);
  }, [lPath]);

  // Fetch data on period change
  const loadPeriod = useCallback(async (p: Period) => {
    setLoad(true); setHov(null);
    try {
      const r = await fetch(`/api/stock/${ticker}/chart?period=${p}`);
      const d = await r.json();
      if (Array.isArray(d) && d.length > 1) setData(d);
    } finally { setLoad(false); }
  }, [ticker]);

  function changePeriod(p: Period) { setPer(p); loadPeriod(p); }

  // Mouse handlers
  const onMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!wrapRef.current || !xy.length) return;
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    setHov(nearestIdx(xy, e.clientX - rect.left));
  }, [xy]);

  const onLeave = useCallback(() => setHov(null), []);

  // Display values
  const hoverPt    = hoverIdx !== null ? data[hoverIdx] : null;
  const hoverXY    = hoverIdx !== null ? xy[hoverIdx]   : null;
  const dispPrice  = hoverPt?.value ?? (data[data.length - 1]?.value ?? initialPrice);
  const basePrice  = data[0]?.value ?? initialPrice;
  const diff       = dispPrice - basePrice;
  const pct        = basePrice ? (diff / basePrice) * 100 : 0;

  const gradId = `g-${ticker}`;
  const clipId = `c-${ticker}`;

  // Don't render SVG until we know the width
  if (W === 0) {
    return (
      <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden">
        <div ref={wrapRef} style={{ height: H + 60 }}
          className="flex items-center justify-center text-gray-600 text-sm">
          Loading chart...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden select-none">

      {/* Header */}
      <div className="flex items-start justify-between px-5 pt-5 pb-2">
        <div>
          <div className="text-3xl font-bold text-white tracking-tight">
            ${dispPrice.toFixed(2)}
          </div>
          <div className={`flex items-center gap-1.5 mt-1 text-sm font-medium ${diff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            <span>{diff >= 0 ? '▲' : '▼'}</span>
            <span>{diff >= 0 ? '+' : ''}{diff.toFixed(2)}</span>
            <span className="opacity-70">({pct >= 0 ? '+' : ''}{pct.toFixed(2)}%)</span>
            {hoverPt && (
              <span className="text-gray-500 font-normal text-xs ml-1">
                {new Date(hoverPt.time * 1000).toLocaleString('en-US', {
                  month: 'short', day: 'numeric',
                  hour: period === '1D' || period === '1W' ? '2-digit' : undefined,
                  minute: period === '1D' || period === '1W' ? '2-digit' : undefined,
                })}
              </span>
            )}
          </div>
        </div>

        {/* Period picker */}
        <div className="flex gap-0.5 bg-white/5 rounded-xl p-1">
          {PERIODS.map(p => (
            <button key={p} onClick={() => changePeriod(p)} disabled={loading}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40 ${
                period === p ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-200'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div ref={wrapRef} className="relative w-full">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-[#111]/70 rounded-xl">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
              className="w-5 h-5 rounded-full border-2 border-t-transparent"
              style={{ borderColor: `${color} transparent ${color} ${color}` }} />
          </div>
        )}

        {data.length < 2 ? (
          <div className="flex items-center justify-center text-gray-600 text-sm" style={{ height: H }}>
            No chart data available
          </div>
        ) : (
          <svg width={W} height={H}
            onMouseMove={onMove} onMouseLeave={onLeave}
            className="cursor-crosshair block">
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"    stopColor={color} stopOpacity="0.22" />
                <stop offset="100%" stopColor={color} stopOpacity="0"    />
              </linearGradient>
              <clipPath id={clipId}>
                <rect x={PAD.l} y={PAD.t} width={W - PAD.l - PAD.r} height={H - PAD.t - PAD.b} />
              </clipPath>
            </defs>

            {/* Grid lines */}
            {pTicks.map((pt, i) => (
              <line key={i} x1={PAD.l} x2={W - PAD.r} y1={pt.y} y2={pt.y}
                stroke="#1c1c1c" strokeWidth="1" />
            ))}

            {/* Filled area */}
            <path d={aPath} fill={`url(#${gradId})`} clipPath={`url(#${clipId})`} />

            {/* Price line — animated draw */}
            <path
              ref={lineRef}
              d={lPath}
              fill="none"
              stroke={color}
              strokeWidth="2"
              strokeLinecap="round"
              clipPath={`url(#${clipId})`}
              style={pathLen > 0 ? {
                strokeDasharray: pathLen,
                strokeDashoffset: drawn ? 0 : pathLen,
                transition: drawn
                  ? `stroke-dashoffset ${Math.min(data.length * 5, 900)}ms cubic-bezier(0.25,0.1,0.25,1)`
                  : 'none',
              } : {}}
            />

            {/* Price ticks */}
            {pTicks.map((pt, i) => (
              <text key={i} x={W - PAD.r + 6} y={pt.y + 4}
                fill="#374151" fontSize="11" fontFamily="monospace">
                {pt.label}
              </text>
            ))}

            {/* Time ticks */}
            {tTicks.map((tt, i) => (
              <text key={i} x={tt.x} y={H - 10}
                fill="#374151" fontSize="11" textAnchor="middle" fontFamily="system-ui">
                {tt.label}
              </text>
            ))}

            {/* Crosshair — plain SVG, no AnimatePresence inside SVG */}
            {hoverXY && hoverPt && (
              <g style={{ opacity: 1, transition: 'opacity 0.1s' }}>
                {/* Vertical dashed line */}
                <line
                  x1={hoverXY.x} x2={hoverXY.x}
                  y1={PAD.t} y2={H - PAD.b}
                  stroke="#374151" strokeWidth="1" strokeDasharray="4 3"
                />
                {/* Horizontal dashed line */}
                <line
                  x1={PAD.l} x2={W - PAD.r}
                  y1={hoverXY.y} y2={hoverXY.y}
                  stroke="#374151" strokeWidth="1" strokeDasharray="4 3"
                />
                {/* Dot */}
                <circle cx={hoverXY.x} cy={hoverXY.y} r="5"
                  fill={color} stroke="#0a0a0a" strokeWidth="2" />
                {/* Price pill on right axis */}
                <rect
                  x={W - PAD.r + 4} y={hoverXY.y - 12}
                  width={PAD.r - 8} height={22} rx={5}
                  fill="#1a1a1a" stroke={color} strokeWidth="1" strokeOpacity="0.5"
                />
                <text
                  x={W - PAD.r / 2} y={hoverXY.y + 4}
                  fill={color} fontSize="11" textAnchor="middle"
                  fontFamily="monospace" fontWeight="600"
                >
                  ${hoverPt.value.toFixed(2)}
                </text>
              </g>
            )}
          </svg>
        )}
      </div>
    </div>
  );
}
