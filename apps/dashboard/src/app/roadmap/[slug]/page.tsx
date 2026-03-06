import { PublicRoadmap } from "./public-roadmap";
import type { RoadmapItemRecord } from "@saas-maker/shared-types";

export const dynamic = "force-dynamic";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function PublicRoadmapPage({ params }: Props) {
  const { slug } = await params;

  let items: RoadmapItemRecord[] = [];
  let projectName = "";

  try {
    const res = await fetch(`${API_BASE}/v1/roadmap/public/${slug}`);
    if (res.ok) {
      const data = await res.json();
      items = data.data ?? [];
      projectName = data.project?.name ?? slug;
    }
  } catch {
    // Fetch failed
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <h1 className="text-2xl font-bold">{projectName} Roadmap</h1>
          <p className="text-muted-foreground">See what we&apos;re working on</p>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <PublicRoadmap slug={slug} initialItems={items} />
      </main>
    </div>
  );
}
