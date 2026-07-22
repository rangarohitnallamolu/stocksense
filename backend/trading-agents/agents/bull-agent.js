const Anthropic = require('@anthropic-ai/sdk');
const { ANTHROPIC_KEY, MODEL_ANALYSIS } = require('../shared/config');

const claude = new Anthropic({ apiKey: ANTHROPIC_KEY });

const SYSTEM = `You are a bullish equity analyst. Given market data and news, build the strongest possible BUY case for the stock.
Be honest about the data — if there is no credible bull case, say so with low confidence.
Respond ONLY with valid JSON.`;

async function analyze(snapshot, newsData) {
  const { ticker, price, change_pct, sma20, sma50, above_sma20, above_sma50,
          week52_high, week52_low, beta, pe_ratio, atr14 } = snapshot;

  const news = newsData?.score;
  const headlines = (newsData?.headlines || []).slice(0, 3).join(' | ');

  const prompt = `
Stock: ${ticker} @ $${price} (${change_pct > 0 ? '+' : ''}${(change_pct || 0).toFixed(2)}% today)

Technical:
- SMA20: $${sma20?.toFixed(2) || 'N/A'} (${above_sma20 ? 'ABOVE ✓' : 'BELOW ✗'})
- SMA50: $${sma50?.toFixed(2) || 'N/A'} (${above_sma50 ? 'ABOVE ✓' : 'BELOW ✗'})
- 52w range: $${week52_low?.toFixed(2) || '?'} – $${week52_high?.toFixed(2) || '?'}
- Beta: ${beta?.toFixed(2) || 'N/A'} | P/E: ${pe_ratio?.toFixed(1) || 'N/A'} | ATR14: $${atr14?.toFixed(2) || 'N/A'}

News (${news?.sentiment || 'neutral'}, importance ${news?.importance || 'N/A'}/10):
${headlines || 'No recent news'}
${news?.summary ? `Summary: ${news.summary}` : ''}

Build the BULLISH case. Return JSON:
{
  "thesis": "<2-3 sentence bull case>",
  "confidence": <0-100>,
  "catalysts": ["<catalyst1>", "<catalyst2>"],
  "expected_move_pct": <realistic upside % in next 3-7 sessions>,
  "timeframe_sessions": <1-10>,
  "entry_note": "<any specific entry timing note>"
}`;

  try {
    const msg = await claude.messages.create({
      model: MODEL_ANALYSIS,
      max_tokens: 400,
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = msg.content[0].text.trim().replace(/```json?\n?/g, '').replace(/```/g, '');
    return { ...JSON.parse(text), ticker, entry_price: price };
  } catch (e) {
    return {
      ticker,
      entry_price: price,
      thesis: 'Analysis unavailable',
      confidence: 0,
      catalysts: [],
      expected_move_pct: 0,
      timeframe_sessions: 0,
      entry_note: '',
    };
  }
}

module.exports = { analyze };
