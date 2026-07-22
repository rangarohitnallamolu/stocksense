const axios = require('axios');
const Anthropic = require('@anthropic-ai/sdk');
const { FINNHUB_KEY, ANTHROPIC_KEY, MODEL_FILTER } = require('../shared/config');

const claude = new Anthropic({ apiKey: ANTHROPIC_KEY });

const HIGH_SIGNAL = [
  'contract','deal','partnership','merger','acqui','earn','beat','miss','guid',
  'upgrad','downgr','fda','approv','lawsuit','investig','ceo','resign',
  'billion','restructur','recall','layoff','buyback','dividend','split',
];

async function fetchHeadlines(ticker) {
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  try {
    const r = await axios.get(
      `https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${weekAgo}&to=${today}&token=${FINNHUB_KEY}`,
      { timeout: 5000 }
    );
    return (r.data || []).slice(0, 5);
  } catch { return []; }
}

function isHighSignal(headlines) {
  const text = headlines.join(' ').toLowerCase();
  return HIGH_SIGNAL.some(w => text.includes(w));
}

async function scoreWithClaude(ticker, price, headlines) {
  const h = headlines.slice(0, 3).map(s => s.slice(0, 100)).join(' | ');
  const prompt = `Ticker: ${ticker} @ $${price}\nHeadlines: ${h}\nJSON only: {"sentiment":"bullish|bearish|neutral","importance":1-10,"summary":"<20 words","is_catalyst":bool,"catalyst":"earnings|merger|legal|product|analyst|macro|null"}`;

  try {
    const msg = await claude.messages.create({
      model: MODEL_FILTER,
      max_tokens: 120,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = msg.content[0].text.trim().replace(/```json?\n?/g, '').replace(/```/g, '');
    return JSON.parse(text);
  } catch {
    const pos = ['beat','record','upgrade','buy','surge'].filter(w => h.toLowerCase().includes(w)).length;
    const neg = ['miss','decline','downgrade','sell','drop'].filter(w => h.toLowerCase().includes(w)).length;
    return {
      sentiment: pos > neg ? 'bullish' : neg > pos ? 'bearish' : 'neutral',
      importance: 3,
      summary: 'Rule-based scoring',
      is_catalyst: false,
      catalyst: null,
    };
  }
}

async function scoreAll(snapshots) {
  const results = {};

  await Promise.all(snapshots.map(async (snap) => {
    const news = await fetchHeadlines(snap.ticker);
    const headlines = news.map(n => n.headline);

    if (!headlines.length) {
      results[snap.ticker] = { isHighSignal: false, headlines: [], score: null };
      return;
    }

    const signal = isHighSignal(headlines);
    let score = null;

    if (signal || Math.abs(snap.change_pct || 0) > 2) {
      score = await scoreWithClaude(snap.ticker, snap.price, headlines);
    }

    results[snap.ticker] = {
      isHighSignal: signal || (score?.importance >= 6),
      headlines,
      score,
      rawNews: news.slice(0, 3),
    };
  }));

  return results;
}

module.exports = { scoreAll };
