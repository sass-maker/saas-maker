"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Brain,
  ChevronDown,
  ClipboardList,
  Eye,
  FolderOpen,
  LayoutDashboard,
  LayoutList,
  ListTodo,
  Map,
  Megaphone,
  MessageSquare,
  Settings,
  ShieldCheck,
  Star,
  Users,
  Zap,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { apiFetchClient, getClientToken } from "@/lib/api-client";

interface Project {
  id: string;
  name: string;
  slug: string;
}

const projectNavItems = [
  { label: "Feedback", href: "", icon: MessageSquare },
  { label: "Roadmap", href: "/roadmap", icon: Map },
  { label: "Testimonials", href: "/testimonials", icon: Star },
  { label: "Waitlist", href: "/waitlist", icon: Users },
  { label: "Changelog", href: "/changelog", icon: Megaphone },
  { label: "Knowledge Base", href: "/indexes", icon: Brain },
  // { label: "AI Gateway", href: "/ai", icon: Zap }, // Removed — use free-ai project
  // { label: "AI Mention Check", href: "/ai-mention", icon: Eye }, // Removed — moved to mentionpilot
  { label: "Forms", href: "/forms", icon: ClipboardList },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings },
];

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
        const res = await apiFetchClient<{ data: Project[] }>(
          "/v1/projects",
          token
        );
        setProjects(res.data ?? []);
      } catch {
        // Silently fail — sidebar still works
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
      <Link
        href="/projects"
        className={cn(
          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
          pathname === "/projects"
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        )}
      >
        <LayoutDashboard className="h-4 w-4" />
        Dashboard
      </Link>

      <Link
        href="/fleet"
        className={cn(
          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
          pathname === "/fleet"
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        )}
      >
        <LayoutList className="h-4 w-4" />
        Fleet
      </Link>

      <Link
        href="/standards"
        className={cn(
          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
          pathname === "/standards"
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        )}
      >
        <ShieldCheck className="h-4 w-4" />
        Standards
      </Link>

      <Link
        href="/tasks"
        className={cn(
          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
          pathname === "/tasks"
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        )}
      >
        <ListTodo className="h-4 w-4" />
        Tasks
      </Link>

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
                    className={cn(
                      p.slug === slug && "bg-muted font-medium"
                    )}
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
              item.href === ""
                ? pathname === `/projects/${slug}`
                : pathname.startsWith(href);

            return (
              <li key={item.label}>
                <Link
                  href={href}
                  prefetch={false}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                    isActive
                      ? "bg-muted text-foreground font-medium"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
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
