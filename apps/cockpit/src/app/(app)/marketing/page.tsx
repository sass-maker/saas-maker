import { redirect } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { listMarketingPosts, type MarketingPostRow } from "@/lib/marketing-queue-store";
import { getDashboardSession } from "@/lib/server-session";

import { MarketingQueueClient } from "./marketing-queue-client";

export const dynamic = "force-dynamic";

export default async function MarketingPage() {
  const session = await getDashboardSession();
  if (!session?.user) redirect("/login");

  let posts: MarketingPostRow[] = [];
  let error: string | null = null;
  try {
    posts = await listMarketingPosts({ limit: 300 });
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketing Queue"
        description="Review agent-created post ideas, accept or reject them, then track what has actually been sent."
      />
      {error ? (
        <div className="rounded-lg border border-yellow-800 bg-yellow-950/20 p-4 text-sm text-yellow-400">
          Could not load marketing queue: {error}. Run migration{" "}
          <code>workers/api/migrations/0015_marketing_posts.sql</code> before using this page.
        </div>
      ) : (
        <MarketingQueueClient initialPosts={posts} />
      )}
    </div>
  );
}
