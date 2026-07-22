'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface Result { ticker: string; name: string; }

const POPULAR = [
  { ticker: 'AAPL', name: 'Apple Inc.' },
  { ticker: 'MSFT', name: 'Microsoft Corp.' },
  { ticker: 'NVDA', name: 'NVIDIA Corp.' },
  { ticker: 'GOOGL', name: 'Alphabet Inc.' },
  { ticker: 'TSLA', name: 'Tesla Inc.' },
  { ticker: 'AMZN', name: 'Amazon.com Inc.' },
];

interface SearchBarProps {
  className?: string;
  onSelect?:  (ticker: string, name: string) => void; // if provided, calls this instead of navigating
}

export function SearchBar({ className, onSelect }: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/stock/search?q=${encodeURIComponent(q)}`);
      setResults(await res.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 300);
    return () => clearTimeout(t);
  }, [query, search]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false); setFocused(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function select(ticker: string, name: string) {
    setOpen(false); setFocused(false);
    if (onSelect) {
      onSelect(ticker, name);
      setQuery('');
    } else {
      setQuery('');
      router.push(`/stock/${ticker}`);
    }
  }

  const showPopular = focused && !query;
  const showResults = open && query.length > 0;
  const list = showResults ? results : showPopular ? POPULAR : [];

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className={cn(
        'flex items-center gap-2 bg-white/5 border rounded-xl px-3 py-2 transition-all',
        focused ? 'border-green-500/50 bg-white/8' : 'border-white/10'
      )}>
        {loading
          ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
              className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full flex-shrink-0" />
          : <Search size={15} className="text-gray-500 flex-shrink-0" />}
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { setFocused(true); setOpen(true); }}
          placeholder="Search stocks..."
          className="bg-transparent text-sm text-white placeholder:text-gray-500 focus:outline-none w-full"
        />
        {query && (
          <button onClick={() => { setQuery(''); setResults([]); }} className="text-gray-500 hover:text-white transition-colors">
            <X size={14} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {(showResults || showPopular) && list.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full mt-2 left-0 right-0 bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50 min-w-[280px]"
          >
            {showPopular && (
              <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/5">
                <TrendingUp size={12} className="text-green-400" />
                <span className="text-xs text-gray-500 font-medium">Popular stocks</span>
              </div>
            )}
            {list.map(r => (
              <button
                key={r.ticker}
                onMouseDown={() => select(r.ticker, r.name)}
                className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-white/5 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-white">{r.ticker.slice(0,3)}</span>
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white">{r.ticker}</div>
                  <div className="text-xs text-gray-500 truncate">{r.name}</div>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
