import { PublicRoadmap } from './public-roadmap';
import type { RoadmapItemRecord } from '@saas-maker/contracts';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.sassmaker.com';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `${slug} Roadmap`,
    description: "See what we're building and vote on what matters most to you.",
  };
}

export default async function PublicRoadmapPage({ params }: Props) {
  const { slug } = await params;

  let items: RoadmapItemRecord[] = [];
  let projectName = slug;

  try {
    const res = await fetch(`${API_BASE}/v1/roadmap/public/${slug}`);
    if (res.ok) {
      const data = await res.json();
      items = data.data ?? [];
      projectName = data.project?.name ?? slug;
    }
  } catch {
    // Fetch failed — render empty state
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      {/* Header */}
      <header className="border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded-md bg-indigo-600 flex items-center justify-center">
              <span className="text-xs font-bold text-white">
                {projectName.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="text-sm font-semibold text-neutral-100">{projectName}</span>
          </div>
          <span className="text-xs text-neutral-500 font-medium tracking-wide uppercase">
            Roadmap
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        {/* Hero */}
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-neutral-50 tracking-tight">
            What we&apos;re building
          </h1>
          <p className="mt-2 text-neutral-400 text-sm max-w-md mx-auto">
            Vote on features that matter most to you, and share your own ideas below.
          </p>
        </div>

        <PublicRoadmap slug={slug} initialItems={items} />
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-800 mt-20 py-6">
        <div className="mx-auto max-w-5xl px-6 flex items-center justify-center gap-1 text-xs text-neutral-600">
          <span>Powered by</span>
          <a
            href="https://sassmaker.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-neutral-500 hover:text-neutral-300 transition-colors font-medium"
          >
            SAAS Maker
          </a>
        </div>
      </footer>
    </div>
  );
}
