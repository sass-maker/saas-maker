import { redirect } from 'next/navigation';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDashboardSession } from '@/lib/server-session';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { Megaphone, Bot, Link as LinkIcon } from 'lucide-react';
import Link from 'next/link';
import type { FleetChangelogEntry } from '@saas-maker/contracts';
import { getFleetToday } from '@/lib/fleet-today';
import { formatProjectLabel } from '@/lib/fleet-project-names';

export const dynamic = 'force-dynamic';

const FLEET_CHANGELOG_TIME_ZONE = 'Asia/Kolkata'; // documents the target tz; logic lives in fleet-today.ts

interface FleetDailyResponse {
  date: string;
  entries: FleetChangelogEntry[];
  by_project: Record<string, FleetChangelogEntry[]>;
}

interface Props {
  searchParams: Promise<{ date?: string }>;
}

const typeBadgeVariant: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  feature: 'default',
  improvement: 'secondary',
  fix: 'outline',
  breaking: 'destructive',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function toDisplayDate(date: string) {
  const d = new Date(`${date}T12:00:00Z`);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

async function loadFleetDailyChangelog(date: string) {
  const { env } = getCloudflareContext();
  const db = (
    env as {
      DB?: {
        prepare: (query: string) => {
          bind: (...values: unknown[]) => {
            all: () => Promise<{ results: unknown[] }>;
          };
        };
      };
    }
  ).DB;
  if (!db) throw new Error('D1 database binding is unavailable.');

  const { results } = await db
    .prepare(
      `SELECT ce.*, p.slug AS project_slug, p.name AS project_name
     FROM changelog_entries ce
     JOIN projects p ON ce.project_id = p.id
     WHERE date(datetime(ce.created_at, '+5 hours', '+30 minutes')) = ?
       AND ce.type IN ('feature', 'fix')
     ORDER BY ce.created_at DESC`
    )
    .bind(date)
    .all();

  const entries = results as unknown as FleetChangelogEntry[];
  const byProject: Record<string, FleetChangelogEntry[]> = {};
  for (const entry of entries) {
    const key = entry.project_slug;
    if (!byProject[key]) byProject[key] = [];
    byProject[key].push(entry);
  }

  return { date, entries, by_project: byProject };
}

export default async function FleetChangelogPage({ searchParams }: Props) {
  const session = await getDashboardSession();
  if (!session?.user) redirect('/login');

  const { date: dateParam } = await searchParams;
  const today = getFleetToday();
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;

  let data: FleetDailyResponse = { date, entries: [], by_project: {} };
  let fetchError: string | null = null;

  try {
    data = await loadFleetDailyChangelog(date);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    fetchError = `Could not load fleet changelog: ${message.slice(0, 160)}`;
  }

  const prevDate = new Date(new Date(`${date}T00:00:00Z`).getTime() - 86400000)
    .toISOString()
    .slice(0, 10);
  const nextDate = new Date(new Date(`${date}T00:00:00Z`).getTime() + 86400000)
    .toISOString()
    .slice(0, 10);
  const isToday = date === today;

  const projectSlugs = Object.keys(data.by_project);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fleet Changelog"
        description="Daily cross-fleet entries grouped by project"
      />

      {/* Date nav */}
      <div className="flex items-center gap-3 text-sm">
        <Link
          href={`/fleet/changelog?date=${prevDate}`}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Prev
        </Link>
        <span className="font-medium">{toDisplayDate(date)}</span>
        {!isToday && (
          <Link
            href={`/fleet/changelog?date=${nextDate}`}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Next →
          </Link>
        )}
        {!isToday && (
          <Link
            href="/fleet/changelog"
            className="ml-auto text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            Today
          </Link>
        )}
      </div>

      {fetchError ? (
        <div className="rounded-lg border border-yellow-800 bg-yellow-950/20 p-4 text-sm text-yellow-400">
          {fetchError}
        </div>
      ) : projectSlugs.length === 0 ? (
        <div className="space-y-4">
          <EmptyState
            icon={Megaphone}
            title="No entries for this day"
            description={`Showing feature and fix changelog entries for ${date} in ${FLEET_CHANGELOG_TIME_ZONE}. Completed tasks are not shown here unless they produced a changelog entry.`}
          />
          <Card className="p-4">
            <h2 className="text-sm font-semibold">Empty-state checks</h2>
            <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
              <li>• Confirm the date above matches the local day you expect.</li>
              <li>
                • Confirm completed product tasks created changelog drafts through `pnpm symphony
                done &lt;task-id&gt;`.
              </li>
              <li>
                • Publish or edit drafts from a project changelog page when the copy needs a human
                pass.
              </li>
            </ul>
          </Card>
        </div>
      ) : (
        <div className="space-y-6">
          {projectSlugs.map((slug) => {
            const entries = data.by_project[slug];
            const projectName = entries[0]?.project_name ?? formatProjectLabel(slug);
            return (
              <Card key={slug} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Link
                    href={`/projects/${slug}/changelog`}
                    className="text-sm font-semibold hover:text-cyan-400 transition-colors"
                  >
                    {projectName}
                  </Link>
                  <span className="text-xs text-muted-foreground font-mono">{slug}</span>
                </div>

                <div className="divide-y divide-border/50">
                  {entries.map((entry) => (
                    <details key={entry.id} className="group py-3">
                      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 rounded-md px-1 py-1 hover:bg-muted/40">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="text-xs text-muted-foreground transition-transform group-open:rotate-90">
                            ›
                          </span>
                          <Badge
                            variant={typeBadgeVariant[entry.type] ?? 'secondary'}
                            className="shrink-0 text-xs"
                          >
                            {entry.type}
                          </Badge>
                          <span className="truncate text-sm font-medium">{entry.title}</span>
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatDate(entry.created_at)}
                        </span>
                      </summary>

                      <div className="mt-2 space-y-2 pl-8">
                        {entry.content && (
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            {entry.content}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground/70">
                          {entry.source && (
                            <span className="flex items-center gap-1">
                              <Bot className="h-3 w-3" />
                              {entry.source}
                            </span>
                          )}
                          {entry.agent && <span className="font-mono">{entry.agent}</span>}
                          {entry.task_id ? (
                            <Link
                              href={`/tasks/${entry.task_id}`}
                              className="font-mono text-cyan-600 hover:text-cyan-500"
                            >
                              task:{entry.task_id.slice(0, 8)}
                            </Link>
                          ) : (
                            <span>manual entry</span>
                          )}
                          {entry.evidence && (
                            <span className="flex items-center gap-1">
                              <LinkIcon className="h-3 w-3" />
                              <span className="max-w-xs truncate">{entry.evidence}</span>
                            </span>
                          )}
                          {entry.version && <span className="font-mono">v{entry.version}</span>}
                        </div>
                      </div>
                    </details>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {data.entries.length} feature/fix changelog entr{data.entries.length !== 1 ? 'ies' : 'y'}{' '}
        across {projectSlugs.length} project{projectSlugs.length !== 1 ? 's' : ''}. Task-only
        completions are intentionally hidden.
      </p>
    </div>
  );
}
