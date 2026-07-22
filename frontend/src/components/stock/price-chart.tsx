'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, ColorType, CrosshairMode, AreaSeries } from 'lightweight-charts';
import { motion } from 'framer-motion';

type Period = '1D' | '1W' | '1M' | '3M' | '1Y';
interface Candle { time: number; value: number; open: number; high: number; low: number; close: number; }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySeries = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyChart = any;

const PERIODS: Period[] = ['1D', '1W', '1M', '3M', '1Y'];

interface PriceChartProps {
  ticker:        string;
  initialPrice:  number;
  initialData:   Candle[];   // server-prefetched 1M data — renders instantly
  initialPeriod: Period;
}

function applyData(series: AnySeries, chart: AnyChart, candles: Candle[], setPositive: (v: boolean) => void) {
  if (!candles.length) return;
  const first = candles[0].value;
  const last  = candles[candles.length - 1].value;
  const up    = last >= first;
  setPositive(up);

  const color = up ? '#22c55e' : '#ef4444';
  series.applyOptions({
    lineColor:   color,
    topColor:    up ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.12)',
    bottomColor: 'rgba(0,0,0,0)',
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  series.setData(candles.map((c: Candle) => ({ time: c.time as any, value: c.value })));
  chart.timeScale().fitContent();
}

export function PriceChart({ ticker, initialPrice, initialData, initialPeriod }: PriceChartProps) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const chartRef      = useRef<AnyChart>(null);
  const seriesRef     = useRef<AnySeries>(null);
  const [period, setPeriod]       = useState<Period>(initialPeriod);
  const [loading, setLoading]     = useState(false);  // false — initial data already here
  const [crossPrice, setCrossPrice] = useState<number | null>(null);
  const [isPositive, setPositive] = useState(true);

  // Init chart
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout:     { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#6b7280' },
      grid:       { vertLines: { color: '#1f1f1f' }, horzLines: { color: '#1f1f1f' } },
      crosshair:  { mode: CrosshairMode.Magnet },
      rightPriceScale: { borderColor: '#1f1f1f' },
      timeScale:  { borderColor: '#1f1f1f', timeVisible: true, secondsVisible: false },
      width:  containerRef.current.clientWidth,
      height: 320,
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: '#22c55e', topColor: 'rgba(34,197,94,0.15)',
      bottomColor: 'rgba(0,0,0,0)', lineWidth: 2,
      priceLineVisible: false, crosshairMarkerRadius: 5,
    });

    chart.subscribeCrosshairMove(param => {
      if (param.point) {
        const d = param.seriesData.get(series) as { value?: number } | undefined;
        setCrossPrice(d?.value ?? null);
      } else {
        setCrossPrice(null);
      }
    });

    chartRef.current  = chart;
    seriesRef.current = series;

    // Render server-prefetched data immediately — no loading flash
    if (initialData.length) applyData(series, chart, initialData, setPositive);

    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    });
    ro.observe(containerRef.current);

    return () => { ro.disconnect(); chart.remove(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load data when period changes (not on mount — initial data handles that)
  const loadPeriod = useCallback(async (p: Period) => {
    if (!seriesRef.current || !chartRef.current) return;
    setLoading(true);
    try {
      const res  = await fetch(`/api/stock/${ticker}/chart?period=${p}`);
      const data: Candle[] = await res.json();
      if (data.length) applyData(seriesRef.current, chartRef.current, data, setPositive);
    } finally {
      setLoading(false);
    }
  }, [ticker]);

  function handlePeriod(p: Period) {
    setPeriod(p);
    loadPeriod(p);
  }

  const display = crossPrice ?? initialPrice;

  return (
    <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4">
        <div>
          <div className="text-2xl font-bold text-white">${display.toFixed(2)}</div>
          {crossPrice && (
            <div className={`text-xs mt-0.5 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
              {isPositive ? '+' : ''}{((crossPrice - initialPrice) / initialPrice * 100).toFixed(2)}%
            </div>
          )}
        </div>

        <div className="flex gap-1 bg-white/5 rounded-xl p-1">
          {PERIODS.map(p => (
            <button
              key={p}
              onClick={() => handlePeriod(p)}
              disabled={loading}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 ${
                period === p ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="relative px-2 pb-2">
        {loading && (
          <div className="absolute top-2 right-4 z-10">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
              className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full"
            />
          </div>
        )}
        <div ref={containerRef} className="w-full" />
      </div>
    </div>
  );
}
