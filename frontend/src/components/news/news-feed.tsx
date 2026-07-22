'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, Newspaper, Clock } from 'lucide-react';
import Image from 'next/image';

interface Article {
  id:       number;
  headline: string;
  summary:  string;
  source:   string;
  url:      string;
  image:    string;
  datetime: number;
  category: string;
  related:  string;
}

// Simple rule-based sentiment from headline keywords
function getSentiment(headline: string): 'positive' | 'neutral' | 'negative' {
  const h = headline.toLowerCase();
  const pos = ['surge', 'beat', 'record', 'profit', 'gain', 'rally', 'rise', 'up ', 'high', 'growth', 'strong', 'bullish', 'buy', 'upgrade', 'win'];
  const neg = ['fall', 'drop', 'miss', 'loss', 'decline', 'cut', 'sell', 'downgrade', 'risk', 'crash', 'concern', 'warn', 'down ', 'low', 'weak', 'bearish', 'lawsuit'];
  const posHits = pos.filter(w => h.includes(w)).length;
  const negHits = neg.filter(w => h.includes(w)).length;
  if (posHits > negHits) return 'positive';
  if (negHits > posHits) return 'negative';
  return 'neutral';
}

const SENTIMENT_STYLE = {
  positive: 'bg-green-500/10 text-green-400 border-green-500/20',
  neutral:  'bg-white/5 text-gray-400 border-white/10',
  negative: 'bg-red-500/10 text-red-400 border-red-500/20',
};

function timeAgo(unix: number): string {
  const diff = Math.floor((Date.now() / 1000 - unix));
  if (diff < 60)   return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function NewsCard({ article, index }: { article: Article; index: number }) {
  const sentiment = getSentiment(article.headline);
  const [imgErr, setImgErr] = useState(false);

  return (
    <motion.a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="flex gap-4 p-4 rounded-xl hover:bg-white/3 transition-colors group border border-transparent hover:border-white/5"
    >
      {/* Thumbnail */}
      <div className="flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-white/5 flex items-center justify-center">
        {article.image && !imgErr ? (
          <Image
            src={article.image} alt=""
            width={64} height={64}
            className="object-cover w-full h-full"
            onError={() => setImgErr(true)}
            unoptimized
          />
        ) : (
          <Newspaper size={20} className="text-gray-600" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${SENTIMENT_STYLE[sentiment]}`}>
            {sentiment}
          </span>
          <span className="text-xs text-gray-500">{article.source}</span>
          {article.related && (
            <span className="text-xs bg-white/5 text-gray-400 px-1.5 py-0.5 rounded font-mono">
              {article.related}
            </span>
          )}
          <span className="text-xs text-gray-600 flex items-center gap-1 ml-auto">
            <Clock size={10} />{timeAgo(article.datetime)}
          </span>
        </div>

        <p className="text-sm font-medium text-white leading-snug line-clamp-2 group-hover:text-green-400 transition-colors">
          {article.headline}
        </p>

        {article.summary && article.summary !== article.headline && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-1">{article.summary}</p>
        )}
      </div>

      <ExternalLink size={14} className="text-gray-600 flex-shrink-0 mt-1 group-hover:text-gray-400 transition-colors" />
    </motion.a>
  );
}

interface NewsFeedProps {
  ticker?: string;   // if provided, fetch company news; else fetch market news
  title?:  string;
  limit?:  number;
}

export function NewsFeed({ ticker, title, limit = 10 }: NewsFeedProps) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [showAll,  setShowAll]  = useState(false);

  useEffect(() => {
    const url = ticker ? `/api/stock/${ticker}/news` : '/api/news';
    fetch(url)
      .then(r => r.json())
      .then(d => setArticles(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [ticker]);

  const displayed = showAll ? articles : articles.slice(0, limit);

  return (
    <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Newspaper size={16} className="text-blue-400" />
          <span className="font-semibold text-white text-sm">{title || (ticker ? `${ticker} News` : 'Market News')}</span>
        </div>
        {!loading && articles.length > 0 && (
          <span className="text-xs text-gray-500">{articles.length} articles</span>
        )}
      </div>

      {/* Articles */}
      {loading ? (
        <div className="p-4 space-y-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="flex gap-4 animate-pulse">
              <div className="w-16 h-16 rounded-xl bg-white/5 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-white/5 rounded w-24" />
                <div className="h-4 bg-white/5 rounded w-full" />
                <div className="h-3 bg-white/5 rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : articles.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <Newspaper size={32} className="text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No recent news found</p>
        </div>
      ) : (
        <div className="divide-y divide-white/5">
          <div className="px-1 py-1">
            {displayed.map((a, i) => (
              <NewsCard key={a.id} article={a} index={i} />
            ))}
          </div>

          {articles.length > limit && (
            <div className="px-5 py-3">
              <button
                onClick={() => setShowAll(v => !v)}
                className="text-xs text-green-400 hover:text-green-300 transition-colors font-medium"
              >
                {showAll ? 'Show less ↑' : `Show ${articles.length - limit} more articles ↓`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
