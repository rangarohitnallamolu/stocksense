'use client';
import { SearchBar } from '@/components/stock/search-bar';

export function Topbar({ title }: { title: string }) {
  return (
    <header className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-[#0a0a0a]">
      <h1 className="text-lg font-semibold text-white">{title}</h1>
      <SearchBar className="w-64" />
    </header>
  );
}
