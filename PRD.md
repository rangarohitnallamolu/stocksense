# StockSense — Product Requirements Document

**Version:** 1.1  
**Date:** 2026-06-02  
**Author:** rangarohit.nallamolu@gmail.com  
**Status:** Approved for Development  
**Updated:** Added payment plans + AI analysis upgrade architecture

---

## 1. Executive Summary

StockSense is a modern web application for US stock market analysis, real portfolio
tracking (buy/sell), and personalized alerts. Users get a clean dashboard showing their holdings,
watchlist, financial health of companies, analyst ratings, news — and receive email notifications
when important events happen on their tracked stocks.

---

## 2. Problem Statement

Individual retail investors lack a unified, clean, and affordable tool that combines:
- Real stock analysis with company health metrics in one place
- Actual portfolio P&L tracking (not just paper tracking)
- Personalized alerts for price moves, earnings, news, and analyst changes
- Email notifications so they never miss a critical event

---

## 3. Goals

- Clean, modern UI — dark/light mode
- US market only (NYSE + NASDAQ) with 15-min delayed data
- Actual buy/sell transaction tracking with cost basis and P&L
- All 4 alert types: price, news, earnings, analyst upgrades
- Email notifications via AWS SES
- Admin dashboard for operational visibility
- Start on free API tiers, design for easy upgrade

## 4. Non-Goals (v1)

- Real-time pricing (planned upgrade path)
- Global markets (US only for now)
- Automated trading or brokerage API integration
- Social / community features
- Native mobile app (responsive web only)
- Options, futures, or crypto tracking

> **Designed-in upgrade paths (not built in v1, but architected for):**
> Payment plans via Stripe and AI stock analysis via an LLM API.
> The data model, middleware, and Lambda structure are built to support these from day 1.

---

## 5. User Roles

| Role  | Description |
|-------|-------------|
| User (Free) | Registered investor — limited features per plan |
| User (Pro) | Paid plan — expanded limits + advanced charts |
| User (Premium) | Full plan — AI analysis + real-time upgrade + unlimited |
| Admin | App owner — sees operational costs, user stats, API usage |

### 5.1 Plan Tiers (v1 = Free only. Pro/Premium added when Stripe is wired up.)

| Feature | Free | Pro ($X/mo) | Premium ($Y/mo) |
|---------|------|-------------|-----------------|
| Watchlist stocks | 5 | 25 | Unlimited |
| Alerts | 3 | 20 | Unlimited |
| Portfolio transactions | 10 | Unlimited | Unlimited |
| Price chart history | 1M | 1Y | 5Y |
| Company health scorecard | ✅ | ✅ | ✅ |
| Financials & growth | Basic | Full | Full |
| News feed | ✅ | ✅ | ✅ |
| Analyst ratings | ✅ | ✅ | ✅ |
| Email alerts | ✅ | ✅ | ✅ |
| **AI stock analysis** | ❌ | ❌ | ✅ |
| **Real-time prices** | ❌ | ❌ | ✅ (upgrade) |
| Priority support | ❌ | ❌ | ✅ |

> Prices (X, Y) to be determined based on operating costs when Stripe is added.

---

## 6. User Stories

### Authentication
- Sign up with email + password
- Log in and stay authenticated across sessions
- Reset password via email link
- Log out from any device

### Dashboard (Main Page)
- See total portfolio value and today's P&L at a glance
- See all watchlist stocks with current price + change %
- See recently fired alerts
- Quick-add a stock to watchlist or portfolio from dashboard

### Portfolio (Buy/Sell Tracking)
- Add a buy transaction: ticker, number of shares, price paid, date
- Add a sell transaction: ticker, shares sold, price, date
- View all holdings with: shares held, avg cost, current price, total gain/loss, gain %
- View total portfolio value and overall P&L
- View transaction history per stock

### Stock Analysis Page
- Search any US stock by ticker or company name (autocomplete)
- View interactive price chart: 1D, 1W, 1M, 3M, 1Y, 5Y
- View company health scorecard (color-coded)
- View key financial metrics
- View analyst ratings, consensus, price targets
- View growth factor metrics
- View latest news for the company
- Add to watchlist or log a trade from this page

### Watchlist
- Add/remove stocks
- See current price, daily change, 52-week range
- Click to open full stock analysis

### Alerts
- Set price alert: notify when stock goes above or below a price
- Set earnings alert: notify before/after earnings announcement
- Set news alert: notify on breaking news for a stock
- Set analyst alert: notify on upgrades/downgrades
- View all active alerts
- Enable/disable individual alerts
- View alert history (what fired, when, what message)

### Email Notifications
- Receive email when any alert fires
- Email has stock name, trigger reason, current price, and link to stock page
- Configure notification preferences (which alert types to email)

### Admin Dashboard
- Total registered users, active users (last 30 days)
- AWS cost breakdown (pulled from Cost Explorer API)
- API usage stats per external provider (Alpha Vantage, Finnhub, FMP)
- Email stats (sent, opened, failed)
- Lambda invocation counts
- RDS and ElastiCache health status

---

## 7. Feature Specifications

### 7.1 Stock Analysis Page — Sections

#### Price Chart
- Provider: TradingView Lightweight Charts
- Timeframes: 1D, 1W, 1M, 3M, 1Y (5Y on upgrade)
- Shows: OHLC or line chart, volume bars, 50-day / 200-day MA overlay
- Data: Alpha Vantage (delayed 15 min)

#### Company Health Scorecard
| Metric | Source | Scoring |
|--------|--------|---------|
| P/E Ratio | FMP | Red if >50, Green if <20 |
| Debt-to-Equity | FMP | Red if >2, Green if <0.5 |
| Current Ratio | FMP | Red if <1, Green if >2 |
| Profit Margin | FMP | Color-coded |
| Return on Equity | FMP | Color-coded |
| Quick Ratio | FMP | Color-coded |

#### Growth Factor
- Revenue YoY growth %
- EPS growth YoY %
- Analyst EPS estimates (next quarter, next year)
- Price target vs current price (upside %)

#### Funds & Safety
- Beta (volatility vs S&P 500)
- Dividend yield + ex-dividend date
- Institutional ownership %
- Short interest %
- Cash & equivalents
- Free cash flow

#### Analyst Ratings
- Buy / Hold / Sell consensus bar
- Number of analysts
- Average, high, low price targets
- Recent rating changes (last 90 days)

#### News Feed
- Latest 10 articles from Finnhub
- Source, headline, timestamp, sentiment tag (positive/neutral/negative)
- Click opens article in new tab

### 7.2 Portfolio Tracking

**Transaction Entry:**
```
Ticker:     [AAPL        ]
Type:       [Buy ▼]
Shares:     [10          ]
Price/share:[$175.50     ]
Date:       [2025-03-15  ]
Notes:      [Optional    ]
[Add Transaction]
```

**Holdings View:**
```
Ticker | Shares | Avg Cost | Current | Total Value | Gain/Loss | %
AAPL   | 10     | $175.50  | $195.20 | $1,952      | +$197     | +11.2%
MSFT   | 5      | $380.00  | $420.50 | $2,102      | +$202     | +10.6%
```

### 7.3 Alert Types

| Type | Trigger | Email Content |
|------|---------|---------------|
| Price Above | Stock crosses above set price | "AAPL crossed $200 — now at $201.50" |
| Price Below | Stock crosses below set price | "TSLA dropped below $150 — now at $148" |
| Earnings | X days before earnings date | "MSFT reports earnings in 3 days (Jun 5)" |
| News | High-importance news article | Article headline + summary + link |
| Analyst | Rating change or price target update | "JPMorgan upgrades AAPL to Overweight, target $230" |

### 7.4 Admin Dashboard Sections

- **Users**: Total, active last 7d/30d, signups per week (chart)
- **AWS Costs**: Monthly spend by service (pulled via Cost Explorer API)
- **API Usage**: Calls made to each external API, remaining quota
- **Emails**: Sent, delivered, failed via SES metrics
- **System Health**: Lambda error rate, RDS connections, Cache hit rate
- **Stack Info**: Environment, region, versions of all services

---

## 8. Technical Architecture

### 8.1 Infrastructure Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        AWS (us-east-1)                       │
│                                                              │
│  ┌─────────────┐    ┌──────────────┐    ┌────────────────┐  │
│  │  CloudFront  │───▶│  S3 Bucket   │    │  Cognito       │  │
│  │  (CDN/HTTPS) │    │  (Next.js    │    │  User Pool     │  │
│  └──────┬───────┘    │   static)    │    │  (Auth/JWT)    │  │
│         │            └──────────────┘    └────────────────┘  │
│         │                                                     │
│         ▼                                                     │
│  ┌─────────────┐                                             │
│  │ API Gateway │                                             │
│  │ (REST API)  │                                             │
│  └──────┬──────┘                                             │
│         │                                                     │
│         ▼                                                     │
│  ┌─────────────────────────────────────────────┐            │
│  │              Lambda Functions                │            │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │            │
│  │  │  stocks   │  │portfolio │  │  alerts  │  │            │
│  │  └──────────┘  └──────────┘  └──────────┘  │            │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │            │
│  │  │   news   │  │watchlist │  │  admin   │  │            │
│  │  └──────────┘  └──────────┘  └──────────┘  │            │
│  └──────────────────────┬──────────────────────┘            │
│                         │                                    │
│            ┌────────────┼────────────┐                      │
│            ▼            ▼            ▼                      │
│  ┌──────────────┐ ┌──────────┐ ┌──────────────┐            │
│  │ RDS Postgres │ │ElastiCache│ │Secrets Manager│           │
│  │ (db.t3.micro)│ │  Redis   │ │  (API keys)   │           │
│  └──────────────┘ └──────────┘ └──────────────┘            │
│                                                              │
│  ┌──────────────────────┐    ┌─────────────────┐           │
│  │ EventBridge (Cron)   │───▶│ Alert Lambda     │          │
│  │  - Every 15 min      │    │ → SES (Email)    │          │
│  │  - Every 30 min      │    └─────────────────┘           │
│  └──────────────────────┘                                   │
│                                                              │
│  ┌──────────────────────┐                                   │
│  │  CloudWatch          │  (Logs + Metrics + Alarms)        │
│  └──────────────────────┘                                   │
└──────────────────────────────────────────────────────────────┘
          ↑ External APIs
          ├── Alpha Vantage  (quotes + chart data)
          ├── Finnhub        (news + earnings + analysts)
          └── FMP            (financials + ratios + profile)
```

### 8.2 External APIs

| API | Data Provided | Free Tier Limit |
|-----|--------------|-----------------|
| Alpha Vantage | Stock quotes, historical OHLC, RSI/MACD | 25 req/day |
| Finnhub | News, earnings calendar, analyst ratings | 60 req/min |
| Financial Modeling Prep (FMP) | Financials, ratios, profile, growth | 250 req/day |

**Cache Strategy:** All API responses are cached in Redis to stay within free limits.

### 8.3 Database Schema (PostgreSQL)

```sql
-- User preferences (Cognito owns credentials)
CREATE TABLE user_profiles (
    user_id       VARCHAR(128) PRIMARY KEY,  -- Cognito sub
    email         VARCHAR(255) UNIQUE NOT NULL,
    display_name  VARCHAR(100),
    plan          VARCHAR(20) DEFAULT 'free' CHECK (plan IN ('free','pro','premium')),
    notify_price  BOOLEAN DEFAULT true,
    notify_news   BOOLEAN DEFAULT true,
    notify_earnings BOOLEAN DEFAULT true,
    notify_analyst BOOLEAN DEFAULT true,
    created_at    TIMESTAMP DEFAULT NOW()
);

-- Subscriptions — table exists from day 1, populated when Stripe is added
CREATE TABLE subscriptions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             VARCHAR(128) REFERENCES user_profiles(user_id),
    stripe_customer_id  VARCHAR(100),
    stripe_sub_id       VARCHAR(100),
    plan                VARCHAR(20) NOT NULL,
    status              VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','canceled','past_due','trialing')),
    current_period_end  TIMESTAMP,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);

-- AI analysis cache — avoid re-calling the LLM API for same stock same day
CREATE TABLE ai_analysis_cache (
    ticker        VARCHAR(10) NOT NULL,
    analysis_text TEXT NOT NULL,
    model_used    VARCHAR(50),
    generated_at  TIMESTAMP DEFAULT NOW(),
    expires_at    TIMESTAMP,
    PRIMARY KEY (ticker)
);

-- Portfolio transactions (source of truth)
CREATE TABLE transactions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     VARCHAR(128) REFERENCES user_profiles(user_id),
    ticker      VARCHAR(10) NOT NULL,
    type        VARCHAR(4) NOT NULL CHECK (type IN ('buy','sell')),
    shares      DECIMAL(12,4) NOT NULL,
    price       DECIMAL(12,2) NOT NULL,
    trade_date  DATE NOT NULL,
    notes       TEXT,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Watchlist
CREATE TABLE watchlist (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     VARCHAR(128) REFERENCES user_profiles(user_id),
    ticker      VARCHAR(10) NOT NULL,
    added_at    TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, ticker)
);

-- Alerts
CREATE TABLE alerts (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       VARCHAR(128) REFERENCES user_profiles(user_id),
    ticker        VARCHAR(10) NOT NULL,
    alert_type    VARCHAR(20) NOT NULL CHECK (
                    alert_type IN ('price_above','price_below','earnings','news','analyst')
                  ),
    threshold     DECIMAL(12,2),  -- for price alerts
    is_active     BOOLEAN DEFAULT true,
    created_at    TIMESTAMP DEFAULT NOW()
);

-- Alert history log
CREATE TABLE alert_history (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id    UUID REFERENCES alerts(id),
    user_id     VARCHAR(128),
    ticker      VARCHAR(10),
    message     TEXT NOT NULL,
    email_sent  BOOLEAN DEFAULT false,
    fired_at    TIMESTAMP DEFAULT NOW()
);

-- API call tracking (for admin dashboard)
CREATE TABLE api_usage_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider    VARCHAR(50),  -- 'alphavantage', 'finnhub', 'fmp'
    endpoint    VARCHAR(100),
    called_at   TIMESTAMP DEFAULT NOW()
);
```

### 8.4 Redis Cache Keys

```
stock:quote:{TICKER}          TTL: 15 min   (delayed quote)
stock:chart:{TICKER}:{period} TTL: 15 min   (OHLC data)
stock:profile:{TICKER}        TTL: 24 hrs   (company info)
stock:financials:{TICKER}     TTL: 6 hrs    (ratios, statements)
stock:analysts:{TICKER}       TTL: 6 hrs    (ratings, targets)
stock:news:{TICKER}           TTL: 30 min   (news articles)
stock:earnings:{TICKER}       TTL: 6 hrs    (earnings calendar)
search:autocomplete:{query}   TTL: 1 hr     (search results)
ai:analysis:{TICKER}          TTL: 6 hrs    (AI analysis — Premium only)
user:plan:{USER_ID}           TTL: 5 min    (plan tier check — avoid DB hit per request)
```

### 8.5 Lambda Functions

| Function | Trigger | Purpose |
|----------|---------|---------|
| `get-stock-quote` | API Gateway | Fetch quote (Redis → Alpha Vantage) |
| `get-stock-chart` | API Gateway | Fetch OHLC chart data |
| `get-company-info` | API Gateway | Profile + financials + analysts |
| `get-news` | API Gateway | News feed for a ticker |
| `search-stocks` | API Gateway | Autocomplete search |
| `portfolio-crud` | API Gateway | Add/get/delete transactions |
| `watchlist-crud` | API Gateway | Manage watchlist |
| `alerts-crud` | API Gateway | Create/list/toggle alerts |
| `alert-price-checker` | EventBridge 15min | Check price thresholds → SES |
| `alert-news-checker` | EventBridge 30min | New news → SES |
| `alert-earnings-checker` | EventBridge 6hr | Upcoming earnings → SES |
| `alert-analyst-checker` | EventBridge 1hr | Rating changes → SES |
| `admin-stats` | API Gateway | User + cost + API stats |
| `ai-analysis` | API Gateway | LLM API call → stock insight (Premium gate) |
| `stripe-webhook` | API Gateway POST /webhooks/stripe | Handle payment events → update plan |
| `create-checkout` | API Gateway | Create Stripe checkout session |
| `manage-subscription` | API Gateway | Cancel / upgrade subscription |

---

## 9. Frontend Pages & Components

```
/ (redirect to /dashboard if logged in, else /login)
/login
/signup
/forgot-password

/dashboard
  ├── PortfolioSummaryCard    (total value, day P&L)
  ├── WatchlistTable          (prices + change %)
  ├── AlertHistoryFeed        (recent 5 alerts)
  └── QuickSearchBar

/portfolio
  ├── HoldingsTable           (shares, avg cost, P&L)
  ├── AddTransactionModal
  ├── TransactionHistory
  └── PortfolioChart          (total value over time)

/stock/:ticker
  ├── StockHeader             (name, price, change)
  ├── PriceChart              (TradingView, timeframe selector)
  ├── HealthScorecard         (6 metrics, color-coded)
  ├── FinancialsPanel         (P/E, margins, growth)
  ├── AnalystPanel            (consensus, targets, changes)
  ├── NewsPanel               (10 articles)
  └── ActionBar               (Add to Watchlist / Log Trade / Set Alert)

/watchlist
  └── WatchlistTable + manage

/alerts
  ├── ActiveAlertsList
  ├── CreateAlertModal
  └── AlertHistoryTable

/settings
  └── NotificationPreferences

/admin                        (protected — admin only)
  ├── UserStatsCard
  ├── AWSCostBreakdown
  ├── APIUsageChart
  ├── EmailStatsCard
  └── SystemHealthGrid
```

---

## 10. Domain & Hosting

### Free Option (Recommended to Start)
- **AWS Amplify subdomain**: `stocksense.amplifyapp.com` — 100% free
- HTTPS included automatically
- No domain registration needed

### When Ready for Custom Domain
- **Register on Route 53**: ~$12/year for `.com`
- Alternative registrars: Namecheap (~$10/year) — point to CloudFront
- HTTPS via AWS Certificate Manager: FREE

---

## 11. Cost Estimation

### Monthly AWS Costs (~100 active users)

| Service | Tier / Config | Est. Monthly Cost |
|---------|--------------|-------------------|
| S3 (static hosting) | <1GB storage | $0.02 |
| CloudFront | <10GB transfer | $0.85 |
| API Gateway | <1M requests | $3.50 |
| Lambda | <1M invocations | $0 (free tier) |
| RDS PostgreSQL | db.t3.micro, 20GB | $15.00 |
| ElastiCache Redis | cache.t3.micro | $12.50 |
| Cognito | <50k MAU | $0 (free) |
| SES | <62k emails/mo | $0 (free tier) |
| EventBridge | Minimal rules | $0.10 |
| Secrets Manager | 5 secrets | $0.25 |
| CloudWatch | Basic | $0.50 |
| **Total** | | **~$32–33/month** |

### Scale Projections

| Users | Monthly Cost | Notes |
|-------|-------------|-------|
| 100 | ~$33 | Current design |
| 500 | ~$45 | Same infra, Lambda scales free |
| 1,000 | ~$60 | May need RDS upgrade |
| 5,000 | ~$120 | Upgrade RDS + Cache tiers |
| 10,000 | ~$200 | Multi-AZ, larger instances |

### API Free Tier Limits (daily)

| API | Free Limit | Our Usage per User/Day |
|-----|-----------|----------------------|
| Alpha Vantage | 25 calls/day | ~3 calls per active user |
| Finnhub | 60 calls/min | Ample with caching |
| FMP | 250 calls/day | ~2 calls per active user |

> With Redis caching, 100 users can comfortably stay within all free tiers.

---

## 12. Implementation Phases & Timeline

> We build one feature at a time, review, then move to the next.

| Phase | Feature | Est. Time |
|-------|---------|-----------|
| 1 | AWS infra setup + Cognito + Login/Signup UI | 3-4 days |
| 2 | Core UI shell — dashboard layout, nav, dark mode | 2-3 days |
| 3 | Stock search + quote + price chart | 3-4 days |
| 4 | Portfolio — buy/sell transactions, holdings, P&L | 3-4 days |
| 5 | Watchlist — add/remove, dashboard view | 2 days |
| 6 | Company health scorecard + financials deep dive | 3-4 days |
| 7 | Analyst ratings + growth factor panel | 2-3 days |
| 8 | News feed per stock | 2 days |
| 9 | Alerts system (all 4 types) — UI + backend logic | 4-5 days |
| 10 | Email notifications (SES + templates) | 2-3 days |
| 11 | Admin dashboard | 3-4 days |
| 12 | Testing, performance, security polish | 3-4 days |
| **Total** | | **~35-45 days** |

---

## 13. Security Considerations

- All API endpoints protected by Cognito JWT — no anonymous access
- Admin route has separate Cognito group check
- API keys stored in Secrets Manager, never in code or env files
- RDS in private subnet — not publicly accessible
- SES configured with domain verification + DKIM
- CloudFront with WAF rate limiting (basic)
- HTTPS enforced everywhere via CloudFront + ACM

---

## 14. Upgrade Architecture — Payment Plans & AI

These are NOT built in v1, but the entire codebase is structured so adding them requires
**zero breaking changes** — only additive work.

### 14.1 Feature Gate Middleware (Built in Phase 1)

Every Lambda function will import a shared utility from day 1:

```javascript
// shared/featureGate.js — built in Phase 1, gates added later
const PLAN_LIMITS = {
  free:    { watchlist: 5,   alerts: 3,  portfolio: 10, ai: false, realtime: false },
  pro:     { watchlist: 25,  alerts: 20, portfolio: -1, ai: false, realtime: false },
  premium: { watchlist: -1,  alerts: -1, portfolio: -1, ai: true,  realtime: true  },
};

async function getUserPlan(userId, redis, db) {
  const cached = await redis.get(`user:plan:${userId}`);
  if (cached) return cached;
  const { plan } = await db.query('SELECT plan FROM user_profiles WHERE user_id=$1', [userId]);
  await redis.setex(`user:plan:${userId}`, 300, plan);
  return plan;
}

async function assertFeature(userId, feature, redis, db) {
  const plan = await getUserPlan(userId, redis, db);
  const limits = PLAN_LIMITS[plan];
  if (limits[feature] === false) throw new ForbiddenError(`Upgrade to access ${feature}`);
  return limits[feature];
}
```

Every Lambda already calls this — so when Stripe updates `plan` in `user_profiles`,
access control changes automatically with **no Lambda code changes**.

### 14.2 Payment Plans — Stripe Integration

When ready to add payments, the work is:

```
Phase: Stripe Integration (est. 1 week)

1. Create Stripe account + products (Free, Pro, Premium)
2. Add Lambda: create-checkout  →  Stripe Checkout Session
3. Add Lambda: stripe-webhook   →  handle payment events
   - checkout.session.completed → UPDATE user_profiles SET plan='pro'
   - customer.subscription.deleted → UPDATE user_profiles SET plan='free'
4. Add Lambda: manage-subscription (cancel, upgrade)
5. Add /billing page in frontend (current plan, upgrade button, invoice history)
6. Wire SES to send payment receipts

AWS services needed: nothing new — just new Lambda functions + API Gateway routes
Stripe cost: 2.9% + $0.30 per transaction (no monthly fee)
```

**Stripe webhook flow:**
```
Stripe → POST /webhooks/stripe (API Gateway)
              ↓
         stripe-webhook Lambda
              ↓
         Verify Stripe signature
              ↓
         UPDATE user_profiles SET plan = '...'
         UPDATE subscriptions table
              ↓
         Invalidate Redis cache: user:plan:{userId}
              ↓
         SES: send confirmation email
```

### 14.3 AI Stock Analysis — LLM API Integration

When ready to add AI, the work is:

```
Phase: AI Analysis (est. 3-4 days)

1. Add LLM provider API key to Secrets Manager (already planned slot)
2. Add Lambda: ai-analysis
   - Check Premium plan gate (already built)
   - Check Redis cache (ai:analysis:{TICKER})
   - If miss: fetch financials + news + analyst data
   - Call LLM API with structured prompt
   - Cache result 6 hours
   - Store in ai_analysis_cache table
3. Add "AI Insights" panel to /stock/:ticker page (hidden for Free/Pro)
4. Add upgrade prompt when Free/Pro user clicks the AI panel

Cost estimate per AI call:
  - Lightweight model: ~$0.001 per analysis (very cheap)
  - With 6-hour cache: ~4 calls/day per ticker
  - 100 premium users × 5 stocks/day = $2/day = ~$60/month
```

**AI prompt structure:**
```
Given the following data for {TICKER}:
- Current price: ${price} (15-min delayed)
- P/E Ratio: {pe}, Profit Margin: {margin}%, Debt/Equity: {de}
- Revenue growth YoY: {growth}%
- Analyst consensus: {consensus} | Avg target: ${target}
- Recent news headlines: {headlines}

Provide a concise investment analysis covering:
1. Company health summary (2-3 sentences)
2. Growth outlook (2-3 sentences)
3. Key risks to watch (2-3 bullet points)
4. Analyst sentiment summary

Be factual, balanced, and note this is not financial advice.
```

**What AI analysis looks like in the UI:**
```
┌─────────────────────────────────────────┐
│  🤖 AI Analysis   [Premium]  6hr cache  │
├─────────────────────────────────────────┤
│  Company Health                         │
│  Apple shows strong fundamentals with   │
│  a healthy profit margin of 25%...      │
│                                         │
│  Growth Outlook                         │
│  Revenue growth of 8% YoY suggests...  │
│                                         │
│  Key Risks                              │
│  • China revenue dependency (~18%)      │
│  • Services growth slowdown risk        │
│  • Rising competition in wearables      │
│                                         │
│  Analyst Sentiment                      │
│  Consensus is Buy with 28 analysts...  │
│                            [Disclaimer] │
└─────────────────────────────────────────┘
```

### 14.4 Zero-Downtime Upgrade Promise

The architecture guarantees these upgrades require **no database migrations** beyond additive
changes, **no Lambda refactors**, and **no frontend rewrites**:

| Upgrade | DB Change | Lambda Change | Frontend Change |
|---------|-----------|---------------|-----------------|
| Add Pro plan | None (plan column exists) | None (gate already built) | Add billing page |
| Add AI panel | None (table exists) | Add ai-analysis Lambda | Unhide AI panel |
| Real-time prices | None | Swap API provider in config | None |
| Global markets | Add exchange column | Add exchange filter | Add market selector |

## 15. Open Questions & Future Upgrades

| Item | Status | Upgrade Path |
|------|--------|-------------|
| Real-time prices | Delayed (15 min) | Upgrade to Polygon.io $30/mo |
| Global markets | US only | Add Finnhub global when ready |
| Mobile app | Web responsive | React Native later |
| Paid plans / subscriptions | Architected, not built | 1 week of Stripe work |
| AI stock analysis | Architected, not built | 3-4 days of LLM API work |
| Social features | Not in v1 | Future phase |
| Options/crypto | Not in v1 | Future phase |

---

## 15. Getting Started — Phase 1 Checklist

When ready to begin development:

- [ ] Create AWS account (if not existing)
- [ ] Install: Node.js 20+, AWS CLI v2, Git
- [ ] Set AWS region to `us-east-1`
- [ ] Sign up for Alpha Vantage API key (free)
- [ ] Sign up for Finnhub API key (free)
- [ ] Sign up for Financial Modeling Prep API key (free)
- [ ] Confirm project folder: `D:\projects\stocks-app`
- [ ] Begin Phase 1: AWS infra + auth
