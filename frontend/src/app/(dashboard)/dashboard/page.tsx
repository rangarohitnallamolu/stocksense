import { Topbar } from '@/components/layout/topbar';
import { StatsBar } from '@/components/dashboard/stats-bar';
import { RecommendationCard } from '@/components/dashboard/recommendation-card';
import { WatchlistCard } from '@/components/watchlist/watchlist-card';
import { PortfolioChart } from '@/components/dashboard/portfolio-chart';
import { NewsFeed }      from '@/components/news/news-feed';

export const metadata = { title: 'Dashboard — StockApp' };

export default function DashboardPage() {
  return (
    <div className="flex flex-col flex-1">
      <Topbar title="Dashboard" />
      <main className="flex-1 p-6 space-y-6">
        {/* Portfolio returns chart — full width */}
        <PortfolioChart />

        {/* Stats cards */}
        <StatsBar />

        {/* AI Recommendations + Watchlist */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <RecommendationCard />
          <WatchlistCard />
        </div>

        {/* Market news feed */}
        <NewsFeed title="Market News" limit={6} />
      </main>
    </div>
  );
}
