'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, TrendingUp, Briefcase, Star,
  Bell, Settings, LogOut, Bot, Zap, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { authSignOut } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/ui-store';

const nav = [
  { href: '/dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/portfolio',    label: 'Portfolio',    icon: Briefcase },
  { href: '/watchlist',    label: 'Watchlist',    icon: Star },
  { href: '/ai-insights',  label: 'AI Insights',  icon: Bot },
  { href: '/auto-trader',  label: 'Auto Trader',  icon: Zap, badge: 'NEW' },
  { href: '/alerts',       label: 'Alerts',       icon: Bell },
  { href: '/settings',     label: 'Settings',     icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const mobileOpen = useUIStore((s) => s.mobileSidebarOpen);
  const closeMobileSidebar = useUIStore((s) => s.closeMobileSidebar);

  async function handleSignOut() {
    await authSignOut();
    router.push('/login');
  }

  return (
    <>
      {/* Mobile backdrop — tap to close */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeMobileSidebar}
            className="fixed inset-0 bg-black/60 z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      <aside
        className={cn(
          'fixed left-0 top-0 h-full w-60 bg-[#111111] border-r border-white/5 flex flex-col z-50',
          'transition-transform duration-200 ease-out',
          'md:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-6 border-b border-white/5">
          <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center flex-shrink-0">
            <TrendingUp size={16} className="text-black" />
          </div>
          <span className="font-bold text-white text-lg tracking-tight">StockApp</span>
          <button
            onClick={closeMobileSidebar}
            className="ml-auto p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 md:hidden"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {nav.map(({ href, label, icon: Icon, badge }: { href: string; label: string; icon: React.ElementType; badge?: string }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link key={href} href={href} onClick={closeMobileSidebar}>
                <motion.div
                  whileHover={{ x: 2 }}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                    active
                      ? 'bg-green-500/10 text-green-400'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  )}
                >
                  <Icon size={18} />
                  {label}
                  {href === '/ai-insights' && (
                    <span className="ml-auto text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full font-semibold">AI</span>
                  )}
                  {(badge && href !== '/ai-insights') && (
                    <span className="ml-auto text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full font-semibold">{badge}</span>
                  )}
                </motion.div>
              </Link>
            );
          })}
        </nav>

        {/* Sign out */}
        <div className="px-3 pb-4 border-t border-white/5 pt-4">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-red-500/5 transition-colors w-full"
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
