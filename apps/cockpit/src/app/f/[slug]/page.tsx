import type { Metadata } from "next";
import { PublicFeedbackContent } from "@/app/projects/[slug]/feedback/public-feedback-content";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { PublicAuthButtons } from "@/components/public-auth-buttons";

export const dynamic = "force-dynamic";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  let projectName = slug;

  try {
    const res = await fetch(`${API_BASE}/v1/feedback/by-project/${slug}`, {
      next: { revalidate: 0 },
    });
    if (res.ok) {
      const data = await res.json();
      projectName = data.project?.name ?? slug;
    }
  } catch {
    // fallback to slug
  }

  return {
    title: `${projectName} — Feature Requests`,
    description: `Vote on feature requests for ${projectName}`,
  };
}

export default async function PublicBoardPage({ params }: Props) {
  const { slug } = await params;
  const session = await auth.api.getSession({ headers: await headers() });

  let projectName = slug;
  try {
    const res = await fetch(`${API_BASE}/v1/feedback/by-project/${slug}`, {
      next: { revalidate: 0 },
    });
    if (res.ok) {
      const data = await res.json();
      projectName = data.project?.name ?? slug;
    }
  } catch {
    // fallback
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">{projectName}</h1>
            <p className="text-sm text-muted-foreground">
              Feature requests &mdash; vote on what gets built next
            </p>
          </div>
          <div className="flex items-center gap-3">
            <PublicAuthButtons
              slug={slug}
              isSignedIn={!!session?.user}
              userImage={session?.user?.image ?? null}
              userName={session?.user?.name ?? null}
              userEmail={session?.user?.email ?? null}
            />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <PublicFeedbackContent slug={slug} />
      </main>
    </div>
  );
}
