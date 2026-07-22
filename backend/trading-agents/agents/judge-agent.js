const Anthropic = require('@anthropic-ai/sdk');
const { ANTHROPIC_KEY, MODEL_ANALYSIS, DEFAULT_STOP_LOSS_PCT } = require('../shared/config');

const claude = new Anthropic({ apiKey: ANTHROPIC_KEY });

const SYSTEM = `You are a disciplined trading judge. You receive a bull case and a bear case for a stock.
Your job: weigh both arguments and decide whether to BUY, SELL (exit long), SHORT, HOLD (do nothing), or SKIP (insufficient conviction).
You also suggest a realistic take-profit percentage based on the thesis strength and volatility.
No day trading. Favor swing trades lasting 2-7 sessions.
Respond ONLY with valid JSON.`;

async function decide(bull, bear, newsData, snapshot) {
  const news = newsData?.score;

  const prompt = `
Stock: ${snapshot.ticker} @ $${snapshot.price}
ATR14: $${snapshot.atr14?.toFixed(2) || 'N/A'} | Beta: ${snapshot.beta?.toFixed(2) || 'N/A'}

BULL CASE (confidence: ${bull.confidence}/100):
${bull.thesis}
Catalysts: ${bull.catalysts?.join(', ') || 'none'}
Expected move: +${bull.expected_move_pct}% over ${bull.timeframe_sessions} sessions

BEAR CASE (downside confidence: ${bear.downside_confidence}/100):
${bear.counter_thesis}
Risks: ${bear.key_risks?.join(', ') || 'none'}
Max downside: -${bear.max_downside_pct}%

NEWS: ${news?.sentiment || 'neutral'} — ${news?.summary || 'no significant news'}

Your verdict. Return JSON:
{
  "action": "BUY|SHORT|HOLD|SKIP",
  "confidence": <0-100, your overall conviction>,
  "take_profit_pct": <suggested take-profit %, e.g. 8.5>,
  "stop_loss_pct": ${DEFAULT_STOP_LOSS_PCT},
  "reasoning": "<2 sentence explanation of your verdict>",
  "winner": "bull|bear|neutral",
  "historical_accuracy_note": "<any pattern you recognize>"
}`;

  try {
    const msg = await claude.messages.create({
      model: MODEL_ANALYSIS,
      max_tokens: 500,
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = msg.content[0].text.trim().replace(/```json?\n?/g, '').replace(/```/g, '');
    const result = JSON.parse(text);

    return {
      ticker:           snapshot.ticker,
      action:           result.action,
      confidence:       result.confidence,
      entry_price:      snapshot.price,
      take_profit_pct:  result.take_profit_pct,
      stop_loss_pct:    result.stop_loss_pct || DEFAULT_STOP_LOSS_PCT,
      stop_loss_price:  result.action === 'BUY'
                          ? snapshot.price * (1 - (result.stop_loss_pct || DEFAULT_STOP_LOSS_PCT) / 100)
                          : snapshot.price * (1 + (result.stop_loss_pct || DEFAULT_STOP_LOSS_PCT) / 100),
      take_profit_price: result.action === 'BUY'
                          ? snapshot.price * (1 + result.take_profit_pct / 100)
                          : snapshot.price * (1 - result.take_profit_pct / 100),
      bull_thesis:      bull.thesis,
      bear_thesis:      bear.counter_thesis,
      judge_reasoning:  result.reasoning,
      news_summary:     news?.summary || '',
    };
  } catch (e) {
    return {
      ticker:       snapshot.ticker,
      action:       'SKIP',
      confidence:   0,
      entry_price:  snapshot.price,
      judge_reasoning: `Parse error: ${e.message}`,
    };
  }
}

module.exports = { decide };
