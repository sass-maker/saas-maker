'use client';

import { FolderKanban, MessageSquare, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const navItems = [
  // Match specific routes before the broader project detail route.
  { label: 'Feedback inbox', href: '/projects/feedback', icon: MessageSquare },
  { label: 'Subscribers', href: '/projects/subscribers', icon: Users },
  { label: 'Project keys', href: '/projects', icon: FolderKanban },
] as const;

export function SidebarNav({
  onNavigate,
  scoreboardActive = false,
}: {
  onNavigate?: () => void;
  scoreboardActive?: boolean;
} = {}) {
  const pathname = usePathname();
  const activeHref = navItems.find((item) =>
    item.href.includes('?')
      ? scoreboardActive
      : !scoreboardActive && (pathname === item.href || pathname.startsWith(`${item.href}/`))
  )?.href;

  return (
    <nav className="flex flex-col gap-1">
      {navItems.map((item) => {
        const active = activeHref === item.href;
        const Item = scoreboardActive || item.href.includes('?') ? 'a' : Link;
        return (
          <Item
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            onClick={onNavigate}
            className={cn(
              'flex min-h-10 items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            )}
          >
            <item.icon className="h-4 w-4" aria-hidden="true" />
            {item.label}
          </Item>
        );
      })}
    </nav>
  );
}
