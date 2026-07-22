# StockSense

A stock analysis and paper-trading platform — real portfolio tracking, watchlists,
alerts, and a multi-agent AI pipeline that researches, debates, and executes simulated trades.

**Live demo:** [stocksense-rangarohit.vercel.app](https://stocksense-rangarohit.vercel.app)

---

## What it does

- **Authentication** — sign up / log in via AWS Cognito, password reset flow
- **Dashboard** — portfolio value, today's P&L, watchlist snapshot, recent alerts
- **Portfolio tracking** — real buy/sell transactions with cost basis and P&L, not paper-only
- **Stock analysis** — price charts, company health scorecard, growth factors, analyst ratings, news feed
- **Watchlist & alerts** — price moves, earnings, news, and analyst-rating alerts
- **AI insights** — LLM-generated read on a stock, surfaced in the UI
- **Auto-trader** — a page into the multi-agent trading pipeline's live signals and run history

## Multi-agent trading pipeline

A scheduled orchestrator runs a pipeline of specialized agents against a rotating watchlist:

```
data-agent → news-agent → bull-agent ↘
                           bear-agent → judge-agent → risk-agent → execution-agent
                                                                          ↓
                                                                   monitor-agent
```

- **data-agent** — pulls price/fundamentals data for the watchlist
- **news-agent** — pulls and filters recent news for catalyst signal
- **bull-agent / bear-agent** — argue the long and short case independently
- **judge-agent** — weighs both arguments into a confidence-scored call
- **risk-agent** — sizes the position against stop-loss/take-profit and open-position limits
- **execution-agent** — places (paper) trades
- **monitor-agent** — tracks open positions against exit conditions

Runs are logged to Postgres with per-agent token/cost accounting (a lightweight model for cheap
filtering, a larger model for the analysis-heavy steps).

> The live demo runs the frontend only, reading from an already-seeded database — the scheduled
> agent pipeline isn't running continuously online (avoids recurring inference/API costs for a demo).

## Architecture

```
frontend/            Next.js 16 (App Router, Turbopack) — UI + API routes
  src/app/api/...     server-side routes: portfolio, watchlist, alerts, stock data, trading
  src/lib/            db client, auth, stock-data helpers
  src/components/     dashboard, portfolio, watchlist, stock, alerts UI

backend/
  trading-agents/     the multi-agent pipeline (orchestrator + cron schedule)
  agent1/, agent2/    earlier standalone research agents

db-setup/             schema + seed scripts (S&P 500 seed data, token-usage tracking)
aws/                  IAM policy for the deploying user
PRD.md                full product requirements doc
```

## Tech stack

**Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS, TanStack Query, Zustand,
Recharts / lightweight-charts, Framer Motion, AWS Amplify (Cognito)

**Backend / data:** Node.js, PostgreSQL (AWS RDS), AWS Cognito, node-cron

**External APIs:** Finnhub, Financial Modeling Prep, an LLM provider (lightweight model for
filtering, larger model for analysis)

**Infra:** AWS (RDS, Cognito, IAM, Secrets Manager), Vercel (frontend hosting)

## Running locally

```bash
cd frontend
npm install
cp .env.example .env.local   # fill in Cognito, RDS, and API credentials
npm run dev
```

To run the trading pipeline locally:

```bash
cd backend/trading-agents
npm install
npm start   # or: npm run refresh-watchlist
```

Requires a Postgres database matching `db-setup/schema.js` / `db-setup/trading-schema.js`.

## Status

Personal/portfolio project — v1 scope per [PRD.md](PRD.md). Payment plans (Stripe) and a
real-time pricing upgrade are designed into the data model but not yet built.
