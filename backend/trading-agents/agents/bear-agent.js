const Anthropic = require('@anthropic-ai/sdk');
const { ANTHROPIC_KEY, MODEL_ANALYSIS } = require('../shared/config');

const claude = new Anthropic({ apiKey: ANTHROPIC_KEY });

const SYSTEM = `You are a bearish equity analyst and risk-focused short-seller. Given market data and news, build the strongest possible case AGAINST buying this stock.
Be rigorous — identify real downside risks, not hypothetical ones.
Respond ONLY with valid JSON.`;

async function analyze(snapshot, newsData) {
  const { ticker, price, change_pct, sma20, sma50, above_sma20, above_sma50,
          week52_high, pct_from_52h, beta, pe_ratio, atr14 } = snapshot;

  const news = newsData?.score;
  const headlines = (newsData?.headlines || []).slice(0, 3).join(' | ');

  const prompt = `
Stock: ${ticker} @ $${price} (${change_pct > 0 ? '+' : ''}${(change_pct || 0).toFixed(2)}% today)

Technical:
- SMA20: $${sma20?.toFixed(2) || 'N/A'} (${above_sma20 ? 'above — extended?' : 'BELOW — weakness'})
- SMA50: $${sma50?.toFixed(2) || 'N/A'} (${above_sma50 ? 'above' : 'BELOW — bearish'})
- Distance from 52w high: ${pct_from_52h?.toFixed(1) || 'N/A'}%
- Beta: ${beta?.toFixed(2) || 'N/A'} | P/E: ${pe_ratio?.toFixed(1) || 'N/A'} | ATR14: $${atr14?.toFixed(2) || 'N/A'}

News (${news?.sentiment || 'neutral'}, importance ${news?.importance || 'N/A'}/10):
${headlines || 'No recent news'}
${news?.summary ? `Summary: ${news.summary}` : ''}

Build the BEARISH / risk case. Return JSON:
{
  "counter_thesis": "<2-3 sentence bear case / risks>",
  "downside_confidence": <0-100, how confident in downside risk>,
  "key_risks": ["<risk1>", "<risk2>"],
  "max_downside_pct": <realistic max downside % in next 3-7 sessions>,
  "risk_level": "low|medium|high|extreme"
}`;

  try {
    const msg = await claude.messages.create({
      model: MODEL_ANALYSIS,
      max_tokens: 400,
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = msg.content[0].text.trim().replace(/```json?\n?/g, '').replace(/```/g, '');
    return { ...JSON.parse(text), ticker };
  } catch (e) {
    return {
      ticker,
      counter_thesis: 'Risk analysis unavailable',
      downside_confidence: 50,
      key_risks: [],
      max_downside_pct: 5,
      risk_level: 'medium',
    };
  }
}

module.exports = { analyze };
