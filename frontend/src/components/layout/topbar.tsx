'use client';
import { Menu } from 'lucide-react';
import { SearchBar } from '@/components/stock/search-bar';
import { useUIStore } from '@/store/ui-store';

export function Topbar({ title }: { title: string }) {
  const toggleMobileSidebar = useUIStore((s) => s.toggleMobileSidebar);

  return (
    <header className="h-16 border-b border-white/5 flex items-center justify-between gap-3 px-4 md:px-6 bg-[#0a0a0a]">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={toggleMobileSidebar}
          className="p-1.5 -ml-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 md:hidden flex-shrink-0"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <h1 className="text-lg font-semibold text-white truncate">{title}</h1>
      </div>
      <SearchBar className="w-36 sm:w-48 md:w-64" />
    </header>
  );
}
