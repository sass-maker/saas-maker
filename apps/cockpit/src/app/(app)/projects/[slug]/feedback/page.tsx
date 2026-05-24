import { notFound } from "next/navigation";
import { PublicFeedbackContent } from "./public-feedback-content";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api.sassmaker.com";

export default async function PublicFeedbackPage({ params }: Props) {
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
    // API unreachable — still render the page, client will fetch
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{projectName}</h1>
        <p className="text-muted-foreground">Public feature request board</p>
      </div>
      <PublicFeedbackContent slug={slug} />
    </div>
  );
}
