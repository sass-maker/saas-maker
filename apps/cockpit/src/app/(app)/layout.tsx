import Link from "next/link";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { SidebarNav } from "@/components/sidebar-nav";
import { MobileNav } from "@/components/mobile-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { getLocalDevSession, isLocalAuthBypassEnabled } from "@/lib/local-auth";
import { UserMenu } from "@/components/user-menu";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const requestHeaders = await headers();
  const session = isLocalAuthBypassEnabled(requestHeaders.get("host"))
    ? getLocalDevSession()
    : await auth.api.getSession({ headers: requestHeaders });

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
          <UserMenu user={session?.user ?? null} />
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
