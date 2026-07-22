import { Topbar } from '@/components/layout/topbar';
export default function SettingsPage() {
  return (
    <div className="flex flex-col flex-1">
      <Topbar title="Settings" />
      <main className="flex-1 p-6 flex items-center justify-center">
        <p className="text-gray-600">Settings — Phase 10</p>
      </main>
    </div>
  );
}
