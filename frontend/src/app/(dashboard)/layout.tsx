import { Sidebar } from '@/components/layout/sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Sidebar />
      <div className="md:ml-60 min-h-screen flex flex-col">
        {children}
      </div>
    </div>
  );
}
