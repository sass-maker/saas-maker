import { notFound } from 'next/navigation';
import { getCockpitTaskWorkflowArtifactByShareToken } from '@/lib/cockpit-tasks-store';

export const dynamic = 'force-dynamic';

export default async function WorkflowArtifactPage({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}) {
  const { shareToken } = await params;
  const artifact = await getCockpitTaskWorkflowArtifactByShareToken(shareToken).catch(() => null);
  if (!artifact) notFound();

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <article className="mx-auto max-w-3xl">
        <div className="mb-6 space-y-2 border-b pb-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Task workflow artifact
          </p>
          <h1 className="break-words text-2xl font-semibold">{artifact.name}</h1>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {artifact.project_slug ? <span>{artifact.project_slug}</span> : null}
            {artifact.run_id ? <span className="font-mono">run {artifact.run_id}</span> : null}
            <span>
              {new Date(artifact.created_at).toLocaleString('en-US', { timeZone: 'UTC' })}
            </span>
          </div>
        </div>
        <div className="whitespace-pre-wrap break-words text-sm leading-7 [overflow-wrap:anywhere]">
          {artifact.content_markdown}
        </div>
      </article>
    </main>
  );
}
