import { Topbar }           from '@/components/layout/topbar';
import { StockHeader }      from '@/components/stock/stock-header';
import { CustomChart }      from '@/components/stock/custom-chart';
import { CompanyOverview }  from '@/components/stock/company-overview';
import { HealthScorecard }  from '@/components/stock/health-scorecard';
import { FinancialsPanel }  from '@/components/stock/financials-panel';
import { AnalystPanel }     from '@/components/stock/analyst-panel';
import { NewsFeed }         from '@/components/news/news-feed';
import { fetchQuoteAndProfile, fetchMetricsAndProfile, fetchChartData } from '@/lib/stock-data';
import pool from '@/lib/db';
import { notFound } from 'next/navigation';

export default async function StockPage({
  params,
}: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const upper = ticker.toUpperCase();

  const [quote, profileData, initialChartData, aiRecoResult] = await Promise.all([
    fetchQuoteAndProfile(upper),
    fetchMetricsAndProfile(upper),
    fetchChartData(upper, '1M'),
    pool.query(
      `SELECT recommendation, confidence_score, price_target_12m, upside_pct, reasoning, generated_at
       FROM recommendations WHERE ticker=$1 ORDER BY generated_at DESC LIMIT 1`,
      [upper]
    ),
  ]);

  if (!quote.price) notFound();

  const aiReco = aiRecoResult.rows[0] || null;

  return (
    <div className="flex flex-col flex-1">
      <Topbar title={upper} />
      <main className="flex-1 p-6 space-y-4 max-w-6xl mx-auto w-full">

        {/* Header — price, change, watchlist, add trade */}
        <StockHeader
          ticker={upper}
          name={quote.name}
          exchange={quote.exchange}
          industry={quote.industry}
          logo={quote.logo}
          price={quote.price}
          change={quote.change}
          changePct={quote.changePct}
          high={quote.high}
          low={quote.low}
          open={quote.open}
          prevClose={quote.prevClose}
        />

        {/* Price chart */}
        <CustomChart
          ticker={upper}
          initialPrice={quote.price}
          initialData={initialChartData}
          initialPeriod="1M"
        />

        {/* Company overview + AI reco */}
        <CompanyOverview
          profile={profileData.profile}
          metrics={profileData.metrics}
          aiReco={aiReco}
        />

        {/* Health scorecard */}
        <HealthScorecard metrics={profileData.metrics} />

        {/* Financials deep dive */}
        <FinancialsPanel
          metrics={profileData.metrics}
          profile={profileData.profile}
        />

        {/* Analyst ratings + earnings + peers */}
        <AnalystPanel ticker={upper} />

        {/* Company news */}
        <NewsFeed ticker={upper} limit={8} />
      </main>
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  return { title: `${ticker.toUpperCase()} — StockApp` };
}
