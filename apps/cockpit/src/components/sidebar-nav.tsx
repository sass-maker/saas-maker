"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Bot,
  Brain,
  ChevronDown,
  ClipboardList,
  Eye,
  FileJson,
  FolderOpen,
  KeyRound,
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
import { visibleDashboardProjects } from "@/lib/dashboard-projects";

interface Project {
  id: string;
  name: string;
  slug: string;
}

const projectNavItems = [
  { label: "Feedback", href: "", icon: MessageSquare },
  { label: "Progress", href: "/progress", icon: ClipboardList },
  { label: "Roadmap", href: "/roadmap", icon: Map },
  { label: "Testimonials", href: "/testimonials", icon: Star },
  { label: "Waitlist", href: "/waitlist", icon: Users },
  { label: "Changelog", href: "/changelog", icon: Megaphone },
  { label: "Knowledge Base", href: "/knowledge", icon: Brain },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "AI Gateway", href: "/ai", icon: Brain },
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

      <div className="mt-4 px-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
        Control Plane
      </div>

      <Link
        href="/secrets"
        className={cn(
          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
          pathname === "/secrets"
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        )}
      >
        <KeyRound className="h-4 w-4" />
        Secrets
      </Link>

      <Link
        href="/manifest"
        className={cn(
          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
          pathname === "/manifest"
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        )}
      >
        <FileJson className="h-4 w-4" />
        Manifest
      </Link>

      <Link
        href="/jobs"
        className={cn(
          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
          pathname === "/jobs"
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        )}
      >
        <Bot className="h-4 w-4" />
        Activity
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
