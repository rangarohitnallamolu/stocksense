const Anthropic = require('@anthropic-ai/sdk');
const { Client } = require('pg');
const axios = require('axios');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');

const sm = new SecretsManagerClient({ region: 'us-east-1' });
const lambda = new LambdaClient({ region: 'us-east-1' });

const HAIKU_IN  = 0.80 / 1_000_000;
const HAIKU_OUT = 4.00 / 1_000_000;

// Keywords that indicate a Claude call is worth making
const HIGH_SIGNAL = ['contract','deal','partnership','merger','acqui','earn','beat','miss','guid',
  'upgrad','downgr','fda','approv','lawsuit','investig','ceo','resign','billion','restructur','recall'];

async function getSecret(n) {
  return (await sm.send(new GetSecretValueCommand({ SecretId: n }))).SecretString;
}

async function getDb(creds) {
  const c = JSON.parse(creds);
  const db = new Client({ host:c.host, port:c.port, user:c.username, password:c.password, database:c.dbname, ssl:{rejectUnauthorized:false} });
  await db.connect();
  return db;
}

function isHighSignal(headlines) {
  const t = headlines.join(' ').toLowerCase();
  return HIGH_SIGNAL.some(w => t.includes(w));
}

// Rule-based fast analysis — no Claude needed for low-signal news
function ruleBasedAnalysis(headlines) {
  const t = headlines.join(' ').toLowerCase();
  const pos = ['beat','record','growth','surge','rally','upgrade','buy','strong','high'].filter(w => t.includes(w)).length;
  const neg = ['miss','fall','drop','cut','downgrade','sell','weak','low','decline'].filter(w => t.includes(w)).length;
  const sent = pos > neg ? 'positive' : neg > pos ? 'negative' : 'neutral';
  return { importance_score: 3, sentiment: sent, category: 'other', is_catalyst: false,
    catalyst_type: null, catalyst_value_usd: null, catalyst_timeline: null,
    confidence_boost: 0, ai_summary: 'Low-signal news — rule-based.', alert_worthy: false,
    input_tokens: 0, output_tokens: 0, cost_usd: 0 };
}

// Ultra-compressed prompt: ~85 tokens input (was 180)
function buildPrompt(ticker, price, headlines) {
  const h = headlines.slice(0, 2).map(h => h.slice(0, 80)).join(' | ');
  return `${ticker}@$${price}: ${h}\nJSON:{"i":1-10,"s":"vp|p|n|ng|vn","c":"earn|contract|legal|product|macro|analyst|other","x":bool,"xt":"gov|partner|product|earn|merger|null","xv":null,"xt2":null,"b":-20to20,"sum":"<15words","a":bool}`;
}

// Expand compressed keys
const SENT_MAP = { vp:'very_positive', p:'positive', n:'neutral', ng:'negative', vn:'very_negative' };

async function analyzeWithClaude(claude, ticker, price, news, db) {
  const headlines = news.map(n => n.headline);
  const prompt = buildPrompt(ticker, price, headlines);

  const msg = await claude.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 100, // was 180 — JSON is tiny
    messages: [{ role: 'user', content: prompt }],
  });

  const u = msg.usage;
  const cost = (u.input_tokens * HAIKU_IN) + (u.output_tokens * HAIKU_OUT);
  await db.query(
    `INSERT INTO token_usage_log (agent,ticker,model,input_tokens,output_tokens,cost_usd) VALUES ($1,$2,$3,$4,$5,$6)`,
    ['agent1', ticker, 'claude-haiku-4-5', u.input_tokens, u.output_tokens, cost]
  );

  try {
    const text = msg.content[0].text.trim();
    const raw = JSON.parse(text.startsWith('`') ? text.replace(/```json?\n?/g,'').replace(/```/g,'') : text);
    return {
      importance_score: raw.i, sentiment: SENT_MAP[raw.s] || 'neutral',
      category: raw.c, is_catalyst: raw.x,
      catalyst_type: raw.xt === 'null' ? null : raw.xt,
      catalyst_value_usd: raw.xv, catalyst_timeline: raw.xt2,
      confidence_boost: raw.b, ai_summary: raw.sum, alert_worthy: raw.a,
      input_tokens: u.input_tokens, output_tokens: u.output_tokens, cost_usd: cost,
    };
  } catch {
    return { ...ruleBasedAnalysis(headlines), input_tokens: u.input_tokens, output_tokens: u.output_tokens, cost_usd: cost };
  }
}

async function fetchNews(ticker, key) {
  const today = new Date().toISOString().split('T')[0];
  try {
    const r = await axios.get(`https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${today}&to=${today}&token=${key}`, { timeout: 4000 });
    return (r.data || []).slice(0, 2); // max 2 headlines
  } catch { return []; }
}

async function fetchPrice(ticker, key) {
  try {
    const r = await axios.get(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${key}`, { timeout: 4000 });
    return r.data?.c || null;
  } catch { return null; }
}

async function getTickersToScan(db) {
  const r = await db.query(`SELECT DISTINCT ticker FROM (
    SELECT ticker FROM watchlist
    UNION SELECT ticker FROM sp500_tickers WHERE active=true LIMIT 50) t`);
  return r.rows.map(r => r.ticker);
}

exports.handler = async () => {
  const start = Date.now();
  const [fhKey, anthropicKey, dbCreds] = await Promise.all([
    getSecret('stockapp/finnhub/api-key'),
    getSecret('stockapp/anthropic/api-key'),
    getSecret('stockapp/rds/credentials'),
  ]);

  const db = await getDb(dbCreds);
  const claude = new Anthropic({ apiKey: anthropicKey });
  const tickers = await getTickersToScan(db);

  let newsProcessed = 0, claudeCalls = 0, ruleBasedCalls = 0;
  let catalysts = 0, highImp = 0, totalIn = 0, totalOut = 0, totalCost = 0;
  const highTickers = [];

  for (const ticker of tickers) {
    try {
      const [news, price] = await Promise.all([
        fetchNews(ticker, fhKey),
        fetchPrice(ticker, fhKey),
      ]);
      if (!news.length || !price) continue;

      const headlines = news.map(n => n.headline);
      let a;

      if (isHighSignal(headlines)) {
        // High-signal news → call Claude
        a = await analyzeWithClaude(claude, ticker, price, news, db);
        claudeCalls++;
        totalIn   += a.input_tokens;
        totalOut  += a.output_tokens;
        totalCost += a.cost_usd;
      } else {
        // Low-signal → fast rule-based, no Claude call
        a = ruleBasedAnalysis(headlines);
        ruleBasedCalls++;
      }

      newsProcessed++;

      await db.query(
        `INSERT INTO news_analysis (ticker,headline,source,sentiment,importance_score,category,is_catalyst,catalyst_type,catalyst_value,catalyst_timeline,ai_summary)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [ticker, news[0].headline, news[0].source, a.sentiment, a.importance_score,
         a.category, a.is_catalyst, a.catalyst_type, a.catalyst_value_usd, a.catalyst_timeline, a.ai_summary]
      );

      if (a.is_catalyst) catalysts++;
      if (a.importance_score >= 7) { highImp++; highTickers.push(ticker); }
    } catch (e) { console.error(`${ticker}:`, e.message); }
  }

  const duration = Date.now() - start;
  await db.query(
    `INSERT INTO agent1_runs (tickers_scanned,news_processed,catalysts_found,high_importance,duration_ms,input_tokens,output_tokens,cost_usd)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [tickers.length, newsProcessed, catalysts, highImp, duration, totalIn, totalOut, totalCost]
  );

  await db.end();

  if (highTickers.length > 0) {
    await lambda.send(new InvokeCommand({
      FunctionName: 'stockapp-agent2-recommendations',
      InvocationType: 'Event',
      Payload: JSON.stringify({ triggered_by: 'agent1', tickers: highTickers }),
    }));
  }

  const saved = ruleBasedCalls / Math.max(newsProcessed, 1) * 100;
  console.log(`Agent1 done ${duration}ms | claude:${claudeCalls} rule:${ruleBasedCalls} (${saved.toFixed(0)}% saved) | in:${totalIn} out:${totalOut} cost:$${totalCost.toFixed(5)}`);
  return { tickers: tickers.length, claudeCalls, ruleBasedCalls, totalIn, totalOut, totalCost };
};
