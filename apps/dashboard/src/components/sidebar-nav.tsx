"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Brain,
  ClipboardList,
  FolderOpen,
  Megaphone,
  MessageSquare,
  Settings,
  Star,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const projectNavItems = [
  { label: "Feedback", href: "", icon: MessageSquare },
  { label: "Testimonials", href: "/testimonials", icon: Star },
  { label: "Waitlist", href: "/waitlist", icon: Users },
  { label: "Changelog", href: "/changelog", icon: Megaphone },
  { label: "Knowledge Base", href: "/indexes", icon: Brain },
  { label: "Forms", href: "/forms", icon: ClipboardList },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function SidebarNav() {
  const pathname = usePathname();
  const slugMatch = pathname.match(/\/projects\/([^/]+)/);
  const slug = slugMatch?.[1];

  return (
    <nav className="flex flex-col gap-1">
      {/* Projects link - always visible */}
      <Link
        href="/projects"
        className={cn(
          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
          pathname === "/projects"
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        )}
      >
        <FolderOpen className="h-4 w-4" />
        Projects
      </Link>

      {/* Project-level nav items - shown when a project slug is present */}
      {slug && (
        <ul className="mt-3 flex flex-col gap-1">
          <li className="mb-1 px-2 text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
            Project
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

      {/* Message when no project is selected */}
      {!slug && (
        <p className="mt-4 px-2 text-xs text-muted-foreground">
          Select a project to see navigation
        </p>
      )}
    </nav>
  );
}
