'use client';
import { useEffect, useState } from 'react';

interface Point { value: number; }

interface Props {
  ticker:     string;
  isPositive: boolean;
  width?:     number;
  height?:    number;
}

function buildPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = ((pts[i].x + pts[i + 1].x) / 2).toFixed(1);
    const my = ((pts[i].y + pts[i + 1].y) / 2).toFixed(1);
    d += ` Q${pts[i].x.toFixed(1)},${pts[i].y.toFixed(1)} ${mx},${my}`;
  }
  d += ` L${pts[pts.length - 1].x.toFixed(1)},${pts[pts.length - 1].y.toFixed(1)}`;
  return d;
}

export function MiniSparkline({ ticker, isPositive, width = 110, height = 40 }: Props) {
  const W = width;
  const H = height;
  const [data,    setData]    = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/stock/${ticker}/chart?period=1D`)
      .then(r => r.json())
      .then((d: Point[]) => setData(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [ticker]);

  if (loading) {
    return (
      <div style={{ width: W, height: H }} className="rounded-lg bg-white/5 animate-pulse" />
    );
  }

  if (data.length < 3) {
    return (
      <div style={{ width: W, height: H }} className="rounded-lg bg-white/5 flex items-center justify-center text-gray-700 text-xs">—</div>
    );
  }

  const values = data.map(d => d.value);
  const minV   = Math.min(...values);
  const maxV   = Math.max(...values);
  const rng    = maxV - minV || 1;
  const padT   = 4;
  const padB   = 4;
  const plotH  = H - padT - padB;

  const pts = values.map((v, i) => ({
    x: (i / (values.length - 1)) * W,
    y: padT + (1 - (v - minV) / rng) * plotH,
  }));

  const line  = buildPath(pts);
  const area  = `${line} L${pts[pts.length - 1].x},${H - padB} L0,${H - padB} Z`;
  const color = isPositive ? '#22c55e' : '#ef4444';
  const fill  = isPositive ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.13)';
  const gradId = `sg-${ticker}`;

  return (
    <svg width={W} height={H} className="overflow-visible">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0"    />
        </linearGradient>
        <clipPath id={`clip-${ticker}`}>
          <rect x="0" y={padT} width={W} height={plotH} />
        </clipPath>
      </defs>
      {/* Gradient fill */}
      <path d={area} fill={`url(#${gradId})`} clipPath={`url(#clip-${ticker})`} />
      {/* Line */}
      <path d={line} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinecap="round" clipPath={`url(#clip-${ticker})`} />
      {/* Start dot */}
      <circle cx={pts[0].x} cy={pts[0].y} r="2" fill={color} opacity="0.5" />
      {/* End dot */}
      <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="2.5" fill={color} />
    </svg>
  );
}
