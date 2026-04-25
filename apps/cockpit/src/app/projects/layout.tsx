import Link from "next/link";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User } from "lucide-react";
import { SidebarNav } from "@/components/sidebar-nav";
import { MobileNav } from "@/components/mobile-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/components/sign-out-button";

export default async function ProjectsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <div className="min-h-screen flex">
      {/* Sidebar - hidden on mobile */}
      <aside className="hidden md:flex w-64 flex-col border-r bg-background h-screen sticky top-0">
        {/* Logo */}
        <div className="p-4 border-b flex items-center justify-between">
          <Link href="/projects" className="text-lg font-bold">
            SaaS Maker
          </Link>
          <ThemeToggle />
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto p-3">
          <SidebarNav />
        </div>

        {/* User menu at bottom */}
        <div className="border-t p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-start gap-2">
                {session?.user?.image ? (
                  <img
                    src={session.user.image}
                    alt={session.user.name ?? "User"}
                    className="h-6 w-6 rounded-full"
                  />
                ) : (
                  <User className="h-4 w-4" />
                )}
                <span className="truncate text-sm">
                  {session?.user?.name ?? "Account"}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {session?.user?.email && (
                <DropdownMenuItem
                  disabled
                  className="text-xs text-muted-foreground"
                >
                  {session.user.email}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild>
                <SignOutButton />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {/* Mobile header - only shows on small screens */}
        <header className="md:hidden sticky top-0 z-50 border-b bg-background px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MobileNav />
            <Link href="/projects" className="text-lg font-bold">
              SaaS Maker
            </Link>
          </div>
          <ThemeToggle />
        </header>

        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
