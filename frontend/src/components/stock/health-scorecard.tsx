'use client';
import { motion } from 'framer-motion';

interface Metrics {
  pe:           number | null;
  pb:           number | null;
  eps:          number | null;
  roe:          number | null;
  roa:          number | null;
  netMargin:    number | null;
  grossMargin:  number | null;
  beta:         number | null;
  week52High:   number | null;
  week52Low:    number | null;
  week52Return: number | null;
  dividendYield:number | null;
  debtEquity:   number | null;
  currentRatio: number | null;
}

interface Score {
  label:    string;
  value:    string;
  raw:      number | null;
  score:    number;       // 0–100
  grade:    'excellent' | 'good' | 'fair' | 'poor';
  note:     string;
}

const GRADE_STYLES = {
  excellent: { bar: 'bg-emerald-400', text: 'text-emerald-400', badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' },
  good:      { bar: 'bg-green-400',   text: 'text-green-400',   badge: 'bg-green-500/15   text-green-400   border-green-500/25'   },
  fair:      { bar: 'bg-yellow-400',  text: 'text-yellow-400',  badge: 'bg-yellow-500/15  text-yellow-400  border-yellow-500/25'  },
  poor:      { bar: 'bg-red-400',     text: 'text-red-400',     badge: 'bg-red-500/15     text-red-400     border-red-500/25'     },
};

function gradePE(pe: number | null): Score {
  if (!pe || pe <= 0) return { label:'P/E Ratio', value:'N/A', raw:pe, score:50, grade:'fair', note:'Negative or no earnings' };
  const score = pe < 15 ? 90 : pe < 25 ? 75 : pe < 40 ? 50 : pe < 60 ? 30 : 10;
  const grade = score >= 80 ? 'excellent' : score >= 65 ? 'good' : score >= 40 ? 'fair' : 'poor';
  const note  = pe < 15 ? 'Undervalued' : pe < 25 ? 'Fairly valued' : pe < 40 ? 'Moderately priced' : 'Expensive';
  return { label:'P/E Ratio', value:`${pe.toFixed(1)}x`, raw:pe, score, grade, note };
}

function gradeMargin(margin: number | null): Score {
  if (margin == null) return { label:'Net Margin', value:'N/A', raw:null, score:50, grade:'fair', note:'No data' };
  const pct   = margin * 100;
  const score = pct > 25 ? 95 : pct > 15 ? 80 : pct > 8 ? 65 : pct > 0 ? 45 : 15;
  const grade = score >= 80 ? 'excellent' : score >= 65 ? 'good' : score >= 40 ? 'fair' : 'poor';
  const note  = pct > 25 ? 'Exceptional' : pct > 15 ? 'Strong' : pct > 8 ? 'Moderate' : pct > 0 ? 'Thin' : 'Losing money';
  return { label:'Net Margin', value:`${pct.toFixed(1)}%`, raw:margin, score, grade, note };
}

function gradeROE(roe: number | null): Score {
  if (roe == null) return { label:'Return on Equity', value:'N/A', raw:null, score:50, grade:'fair', note:'No data' };
  const pct   = roe * 100;
  const score = pct > 25 ? 95 : pct > 15 ? 80 : pct > 8 ? 60 : pct > 0 ? 40 : 10;
  const grade = score >= 80 ? 'excellent' : score >= 60 ? 'good' : score >= 40 ? 'fair' : 'poor';
  const note  = pct > 25 ? 'Exceptional' : pct > 15 ? 'Strong' : pct > 8 ? 'Decent' : pct > 0 ? 'Weak' : 'Negative';
  return { label:'Return on Equity', value:`${pct.toFixed(1)}%`, raw:roe, score, grade, note };
}

function gradeDebt(de: number | null): Score {
  if (de == null) return { label:'Debt / Equity', value:'N/A', raw:null, score:50, grade:'fair', note:'No data' };
  const score = de < 0.3 ? 95 : de < 0.8 ? 80 : de < 1.5 ? 60 : de < 2.5 ? 35 : 15;
  const grade = score >= 80 ? 'excellent' : score >= 60 ? 'good' : score >= 35 ? 'fair' : 'poor';
  const note  = de < 0.3 ? 'Debt-free' : de < 0.8 ? 'Low debt' : de < 1.5 ? 'Manageable' : de < 2.5 ? 'High debt' : 'Very high debt';
  return { label:'Debt / Equity', value:`${de.toFixed(2)}x`, raw:de, score, grade, note };
}

function gradeCurrentRatio(cr: number | null): Score {
  if (cr == null) return { label:'Current Ratio', value:'N/A', raw:null, score:50, grade:'fair', note:'No data' };
  const score = cr > 3 ? 85 : cr > 2 ? 95 : cr > 1.5 ? 80 : cr > 1 ? 55 : 20;
  const grade = score >= 80 ? 'excellent' : score >= 60 ? 'good' : score >= 40 ? 'fair' : 'poor';
  const note  = cr > 2 ? 'Very liquid' : cr > 1.5 ? 'Healthy' : cr > 1 ? 'Adequate' : 'Liquidity risk';
  return { label:'Current Ratio', value:`${cr.toFixed(2)}x`, raw:cr, score, grade, note };
}

function gradeBeta(beta: number | null): Score {
  if (beta == null) return { label:'Beta (Risk)', value:'N/A', raw:null, score:50, grade:'fair', note:'No data' };
  const score = beta < 0.5 ? 70 : beta < 0.8 ? 85 : beta < 1.2 ? 75 : beta < 1.8 ? 55 : 35;
  const grade = score >= 80 ? 'good' : score >= 65 ? 'fair' : 'poor';
  const risk  = beta < 0.5 ? 'Very low risk' : beta < 0.8 ? 'Low risk' : beta < 1.2 ? 'Market risk' : beta < 1.8 ? 'High risk' : 'Very high risk';
  return { label:'Beta (Volatility)', value:`${beta.toFixed(2)}`, raw:beta, score, grade, note:risk };
}

function overallScore(scores: Score[]): { score: number; label: string; color: string } {
  const valid = scores.filter(s => s.raw != null);
  if (!valid.length) return { score: 0, label: 'N/A', color: 'text-gray-400' };
  const avg = valid.reduce((s, sc) => s + sc.score, 0) / valid.length;
  const label = avg >= 80 ? 'Excellent' : avg >= 65 ? 'Good' : avg >= 45 ? 'Fair' : 'Weak';
  const color = avg >= 80 ? 'text-emerald-400' : avg >= 65 ? 'text-green-400' : avg >= 45 ? 'text-yellow-400' : 'text-red-400';
  return { score: Math.round(avg), label, color };
}

function ScoreCard({ s, index }: { s: Score; index: number }) {
  const style = GRADE_STYLES[s.grade];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="bg-white/3 border border-white/5 rounded-2xl p-4 flex flex-col gap-3"
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-gray-500 font-medium">{s.label}</div>
          <div className={`text-2xl font-bold mt-0.5 ${s.raw != null ? style.text : 'text-gray-500'}`}>
            {s.value}
          </div>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold capitalize ${style.badge}`}>
          {s.grade}
        </span>
      </div>

      {/* Score bar */}
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-600">Score</span>
          <span className={`font-semibold ${style.text}`}>{s.score}/100</span>
        </div>
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${s.score}%` }}
            transition={{ duration: 0.8, delay: index * 0.06 + 0.3, ease: 'easeOut' }}
            className={`h-full rounded-full ${style.bar}`}
          />
        </div>
      </div>

      <div className="text-xs text-gray-500">{s.note}</div>
    </motion.div>
  );
}

export function HealthScorecard({ metrics }: { metrics: Metrics }) {
  const scores = [
    gradeMargin(metrics.netMargin),
    gradeROE(metrics.roe),
    gradeDebt(metrics.debtEquity),
    gradeCurrentRatio(metrics.currentRatio),
    gradePE(metrics.pe),
    gradeBeta(metrics.beta),
  ];

  const overall = overallScore(scores);

  return (
    <div className="bg-[#111] border border-white/5 rounded-2xl p-5">
      {/* Header with overall score */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-semibold text-white">Company Health</h3>
          <p className="text-xs text-gray-500 mt-0.5">Financial strength across 6 key metrics</p>
        </div>
        <div className="text-right">
          <div className={`text-3xl font-bold ${overall.color}`}>{overall.score}</div>
          <div className={`text-xs font-semibold mt-0.5 ${overall.color}`}>{overall.label}</div>
        </div>
      </div>

      {/* Overall bar */}
      <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-6">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${overall.score}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className={`h-full rounded-full ${
            overall.score >= 80 ? 'bg-emerald-400' :
            overall.score >= 65 ? 'bg-green-400' :
            overall.score >= 45 ? 'bg-yellow-400' : 'bg-red-400'
          }`}
        />
      </div>

      {/* 6 metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {scores.map((s, i) => <ScoreCard key={s.label} s={s} index={i} />)}
      </div>
    </div>
  );
}
