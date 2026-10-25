import { headers } from 'next/headers';
import { Activity } from 'lucide-react';
import { SidebarNav } from '@/components/sidebar-nav';
import { MobileNav } from '@/components/mobile-nav';
import { ThemeToggle } from '@/components/theme-toggle';
import { UserMenu } from '@/components/user-menu';
import { CockpitResources } from '@/components/cockpit-resources';
import { SaaSMakerMark } from '@/components/saas-maker-mark';
import { getDashboardSession } from '@/lib/server-session';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const scoreboardActive = requestHeaders.get('x-saasmaker-private-surface') === 'scoreboard';
  const session = await getDashboardSession();

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Sidebar - hidden on mobile */}
      <aside className="hidden md:flex h-screen w-64 shrink-0 flex-col border-r border-border/70 bg-background/82 shadow-[20px_0_70px_-58px_rgba(125,211,252,0.65)] backdrop-blur-xl sticky top-0">
        {/* Logo */}
        <div className="border-b border-border/70 p-4">
          <div className="flex items-center justify-between">
            <a href="/projects/feedback" className="group flex min-w-0 items-center gap-2">
              <SaaSMakerMark />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold tracking-tight">
                  SaaS Maker
                </span>
                <span className="block truncate font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Product workspace
                </span>
              </span>
            </a>
            <ThemeToggle />
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-md border border-border/60 bg-muted/25 px-3 py-2 text-xs text-muted-foreground">
            <Activity className="h-3.5 w-3.5 text-emerald-400" />
            <span className="truncate">Quality and feedback</span>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto p-3">
          <SidebarNav scoreboardActive={scoreboardActive} />
        </div>

        {/* User menu at bottom */}
        <div className="border-t border-border/70 p-3">
          <UserMenu user={session?.user ?? null} />
        </div>
      </aside>

      {/* Main content */}
      <main className={scoreboardActive ? 'min-w-0 flex-1' : 'min-w-0 flex-1 overflow-y-auto'}>
        {/* Mobile header - only shows on small screens */}
        <header className="md:hidden sticky top-0 z-50 border-b border-border/70 bg-background/90 px-4 h-14 flex items-center justify-between backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <MobileNav scoreboardActive={scoreboardActive} />
            <a href="/projects/feedback" className="text-base font-semibold">
              SaaS Maker
            </a>
          </div>
          <ThemeToggle />
        </header>

        <CockpitResources key={session?.user?.id ?? 'guest'}>
          <div
            className={
              scoreboardActive
                ? 'px-4 py-6 sm:px-6 lg:px-8'
                : 'mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8'
            }
          >
            {children}
          </div>
        </CockpitResources>
      </main>
    </div>
  );
}
