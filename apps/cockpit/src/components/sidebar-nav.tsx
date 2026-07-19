'use client';

import {
  BarChart3,
  Bot,
  ChevronDown,
  Eye,
  FolderKanban,
  LayoutList,
  ListTodo,
  Map,
  Megaphone,
  MessageSquare,
  ScrollText,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Users,
  Wrench,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { apiFetchClient, getClientToken } from '@/lib/api-client';
import { visibleDashboardProjects } from '@/lib/dashboard-projects';
import { cn } from '@/lib/utils';

interface Project {
  id: string;
  name: string;
  slug: string;
}

const projectNavItems = [
  { label: 'Feedback', href: '', icon: MessageSquare },
  { label: 'Roadmap', href: '/roadmap', icon: Map },
  { label: 'Testimonials', href: '/testimonials', icon: Star },
  { label: 'Waitlist', href: '/waitlist', icon: Users },
  { label: 'Changelog', href: '/changelog', icon: Megaphone },
  { label: 'AI Gateway', href: '/ai', icon: Zap },
  { label: 'Settings', href: '/settings', icon: Settings },
];

const pillarNav = [
  {
    label: 'Build',
    icon: Wrench,
    items: [
      { label: 'Projects', href: '/projects', icon: FolderKanban },
      { label: 'Tasks', href: '/tasks', icon: ListTodo },
    ],
  },
  {
    label: 'Market',
    icon: Megaphone,
    items: [
      { label: 'Distribution', href: '/marketing', icon: Megaphone },
      { label: 'Public changes', href: '/fleet/changelog', icon: ScrollText },
    ],
  },
  {
    label: 'Learn',
    icon: BarChart3,
    items: [{ label: 'Feedback', href: '/projects/feedback', icon: MessageSquare }],
  },
  {
    label: 'Visibility',
    icon: Eye,
    items: [
      { label: 'Fleet health', href: '/fleet', icon: LayoutList },
      { label: 'Observability', href: '/fleet/observability', icon: BarChart3 },
    ],
  },
  {
    label: 'Control',
    icon: SlidersHorizontal,
    items: [
      { label: 'Activity & jobs', href: '/jobs', icon: Bot },
      { label: 'Standards', href: '/standards', icon: ShieldCheck },
    ],
  },
] as const;

export function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();
  const slugMatch = pathname.match(/\/projects\/([^/]+)/);
  const slug = slugMatch?.[1];

  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);

  useEffect(() => {
    async function loadProjects() {
      try {
        const token = await getClientToken();
        const res = await apiFetchClient<{ data: Project[] }>('/v1/projects', token);
        setProjects(visibleDashboardProjects(res.data ?? []));
      } catch {
        // Silently fail
      }
    }
    loadProjects();
  }, []);

  useEffect(() => {
    if (slug && projects.length > 0) {
      const found = projects.find((p) => p.slug === slug);
      if (found) setCurrentProject(found);
    } else {
      setCurrentProject(null);
    }
  }, [slug, projects]);

  return (
    <nav className="flex flex-col gap-1">
      {pillarNav.map((pillar, pillarIndex) => (
        <section key={pillar.label} className={cn(pillarIndex > 0 && 'mt-3')}>
          <div className="flex items-center gap-2 px-2 pb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60">
            <pillar.icon className="h-3.5 w-3.5" aria-hidden="true" />
            {pillar.label}
          </div>
          <div className="flex flex-col gap-0.5">
            {pillar.items.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== '/projects' && pathname.startsWith(`${item.href}/`));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex min-h-10 items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
                    active
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  )}
                >
                  <item.icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </section>
      ))}

      {slug && currentProject && (
        <ul className="mt-3 flex flex-col gap-1">
          <li className="mb-1 px-1">
            <DropdownMenu>
              <DropdownMenuTrigger className="flex w-full items-center justify-between rounded-md px-1 py-1 text-xs font-medium text-muted-foreground/70 uppercase tracking-wider hover:text-foreground transition-colors">
                <span className="truncate">{currentProject.name}</span>
                <ChevronDown className="h-3 w-3 shrink-0" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                {projects.map((p) => (
                  <DropdownMenuItem
                    key={p.id}
                    onClick={() => router.push(`/projects/${p.slug}`)}
                    className={cn(p.slug === slug && 'bg-muted font-medium')}
                  >
                    {p.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
          {projectNavItems.map((item) => {
            const href = `/projects/${slug}${item.href}`;
            const isActive =
              item.href === '' ? pathname === `/projects/${slug}` : pathname.startsWith(href);

            return (
              <li key={item.label}>
                <Link
                  href={href}
                  prefetch={false}
                  className={cn(
                    'flex min-h-11 items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                    isActive
                      ? 'bg-muted text-foreground font-medium'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {!slug && (
        <p className="mt-4 px-2 text-xs text-muted-foreground">
          Select a fleet project to see navigation
        </p>
      )}
    </nav>
  );
}
