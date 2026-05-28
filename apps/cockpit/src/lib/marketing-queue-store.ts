import { type CockpitD1Database,getCockpitD1 } from '@/lib/cockpit-tasks-store';

export type MarketingPostStatus = 'generated' | 'accepted' | 'rejected' | 'sent';
export type MarketingPostChannel = 'x' | 'linkedin' | 'reddit' | 'email' | 'blog' | 'producthunt' | 'other';
export type MarketingPostSource = 'manual' | 'task' | 'changelog';

export type MarketingPostRow = {
  id: string;
  owner_id: string;
  project_slug: string | null;
  channel: MarketingPostChannel;
  status: MarketingPostStatus;
  title: string;
  hook: string | null;
  body: string;
  cta: string | null;
  asset_url: string | null;
  source_type: MarketingPostSource;
  source_id: string | null;
  task_id: string | null;
  changelog_entry_id: string | null;
  scheduled_for: string | null;
  exported_at: string | null;
  posted_at: string | null;
  result_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type MarketingPostInput = Partial<{
  project_slug: string | null;
  channel: MarketingPostChannel;
  status: MarketingPostStatus;
  title: string;
  hook: string | null;
  body: string;
  cta: string | null;
  asset_url: string | null;
  source_type: MarketingPostSource;
  source_id: string | null;
  task_id: string | null;
  changelog_entry_id: string | null;
  scheduled_for: string | null;
  exported_at: string | null;
  posted_at: string | null;
  result_url: string | null;
  notes: string | null;
}>;

export type MarketingQueueFilters = Partial<{
  status: string;
  project_slug: string;
  channel: string;
  limit: number;
}>;

type ChangelogRow = {
  id: string;
  title: string;
  content: string | null;
  type: string;
  task_id: string | null;
  created_at: string;
  project_slug: string;
  project_name: string;
};

const VALID_STATUSES = ['generated', 'accepted', 'rejected', 'sent'] as const;
const VALID_CHANNELS = ['x', 'linkedin', 'reddit', 'email', 'blog', 'producthunt', 'other'] as const;
const VALID_SOURCES = ['manual', 'task', 'changelog'] as const;

function cleanString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === 'string' && allowed.includes(value as T) ? value as T : undefined;
}

function normalizeInput(input: MarketingPostInput) {
  return {
    project_slug: cleanString(input.project_slug),
    channel: enumValue(input.channel, VALID_CHANNELS),
    status: enumValue(input.status, VALID_STATUSES),
    title: cleanString(input.title) ?? undefined,
    hook: cleanString(input.hook),
    body: cleanString(input.body) ?? undefined,
    cta: cleanString(input.cta),
    asset_url: cleanString(input.asset_url),
    source_type: enumValue(input.source_type, VALID_SOURCES),
    source_id: cleanString(input.source_id),
    task_id: cleanString(input.task_id),
    changelog_entry_id: cleanString(input.changelog_entry_id),
    scheduled_for: cleanString(input.scheduled_for),
    exported_at: cleanString(input.exported_at),
    posted_at: cleanString(input.posted_at),
    result_url: cleanString(input.result_url),
    notes: cleanString(input.notes),
  } satisfies MarketingPostInput;
}

export async function listMarketingPosts(filters: MarketingQueueFilters = {}, db = getCockpitD1()) {
  const conditions = ['1 = 1'];
  const values: unknown[] = [];
  const status = enumValue(filters.status, VALID_STATUSES);
  const channel = enumValue(filters.channel, VALID_CHANNELS);
  const projectSlug = cleanString(filters.project_slug);
  if (status) {
    conditions.push('status = ?');
    values.push(status);
  }
  if (channel) {
    conditions.push('channel = ?');
    values.push(channel);
  }
  if (projectSlug) {
    conditions.push('project_slug = ?');
    values.push(projectSlug);
  }
  const limit = Math.min(Math.max(filters.limit ?? 200, 1), 500);
  values.push(limit);
  const { results } = await db.prepare(
    `SELECT * FROM marketing_posts WHERE ${conditions.join(' AND ')}
     ORDER BY
       CASE status WHEN 'generated' THEN 0 WHEN 'accepted' THEN 1 WHEN 'sent' THEN 2 WHEN 'rejected' THEN 3 ELSE 4 END,
       created_at DESC
     LIMIT ?`
  ).bind(...values).all<Record<string, unknown>>();
  return (results ?? []) as unknown as MarketingPostRow[];
}

export async function getMarketingPost(id: string, db = getCockpitD1()) {
  return await db.prepare('SELECT * FROM marketing_posts WHERE id = ?')
    .bind(id)
    .first<MarketingPostRow>();
}

export async function createMarketingPost(ownerId: string, input: MarketingPostInput, db = getCockpitD1()) {
  const patch = normalizeInput(input);
  if (!patch.title) throw new Error('title is required');
  if (!patch.body) throw new Error('body is required');
  const id = crypto.randomUUID();
  await db.prepare(`INSERT INTO marketing_posts (
    id, owner_id, project_slug, channel, status, title, hook, body, cta, asset_url,
    source_type, source_id, task_id, changelog_entry_id, scheduled_for, exported_at,
    posted_at, result_url, notes
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(
      id,
      ownerId,
      patch.project_slug ?? null,
      patch.channel ?? 'x',
      patch.status ?? 'generated',
      patch.title,
      patch.hook ?? null,
      patch.body,
      patch.cta ?? null,
      patch.asset_url ?? null,
      patch.source_type ?? 'manual',
      patch.source_id ?? null,
      patch.task_id ?? null,
      patch.changelog_entry_id ?? null,
      patch.scheduled_for ?? null,
      patch.exported_at ?? null,
      patch.posted_at ?? null,
      patch.result_url ?? null,
      patch.notes ?? null,
    ).run();
  const post = await getMarketingPost(id, db);
  if (!post) throw new Error('Marketing post was not created');
  return post;
}

export async function updateMarketingPost(id: string, input: MarketingPostInput, db = getCockpitD1()) {
  const patch = normalizeInput(input);
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    sets.push(`${key} = ?`);
    values.push(value);
  }
  if (sets.length === 0) return null;
  sets.push("updated_at = datetime('now')");
  values.push(id);
  await db.prepare(`UPDATE marketing_posts SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run();
  return getMarketingPost(id, db);
}

export async function deleteMarketingPost(id: string, db = getCockpitD1()) {
  const { meta } = await db.prepare('DELETE FROM marketing_posts WHERE id = ?').bind(id).run();
  return (meta?.changes ?? 0) > 0;
}

function postCopyFor(entry: ChangelogRow, channel: MarketingPostChannel) {
  const project = entry.project_name || entry.project_slug;
  const plainTitle = entry.title.replace(/^[^:]+:\s*/, '');
  if (channel === 'linkedin') {
    return {
      title: `${project}: LinkedIn idea from ${entry.type}`,
      hook: `${project} shipped a useful improvement.`,
      body: [
        `${project} update: ${plainTitle}`,
        '',
        entry.content || 'This change improves the product workflow and is ready for users to try.',
        '',
        'Why it matters: small shipped improvements compound when they make the core loop clearer.',
      ].join('\n'),
      cta: `Try ${project} and send feedback.`,
    };
  }
  if (channel === 'reddit') {
    return {
      title: `${project}: Reddit feedback idea from ${entry.type}`,
      hook: `I shipped a small ${project} improvement and want feedback.`,
      body: [
        `I shipped this for ${project}: ${plainTitle}`,
        '',
        entry.content || 'The goal is to make the first-use workflow clearer.',
        '',
        'What would make this more useful or less confusing?',
      ].join('\n'),
      cta: 'Ask for feedback, not upvotes.',
    };
  }
  return {
    title: `${project}: X idea from ${entry.type}`,
    hook: plainTitle,
    body: `${project} update: ${plainTitle}\n\n${entry.content || 'Small product improvement shipped.'}`,
    cta: 'Try it and tell me what breaks.',
  };
}

export async function generateMarketingPostsFromChangelog(ownerId: string, db: CockpitD1Database = getCockpitD1()) {
  const { results } = await db.prepare(
    `SELECT ce.id, ce.title, ce.content, ce.type, ce.task_id, ce.created_at, p.slug AS project_slug, p.name AS project_name
     FROM changelog_entries ce
     JOIN projects p ON ce.project_id = p.id
     WHERE p.owner_id = ?
       AND ce.type IN ('feature', 'fix', 'improvement')
     ORDER BY ce.created_at DESC
     LIMIT 20`
  ).bind(ownerId).all<ChangelogRow>();
  const entries = results ?? [];
  const channels: MarketingPostChannel[] = ['x', 'linkedin', 'reddit'];
  const created: MarketingPostRow[] = [];
  let skipped = 0;
  for (const entry of entries) {
    for (const channel of channels) {
      const duplicate = await db.prepare(
        `SELECT id FROM marketing_posts WHERE owner_id = ? AND source_type = 'changelog' AND source_id = ? AND channel = ? LIMIT 1`
      ).bind(ownerId, entry.id, channel).first<{ id: string }>();
      if (duplicate) {
        skipped += 1;
        continue;
      }
      const copy = postCopyFor(entry, channel);
      created.push(await createMarketingPost(ownerId, {
        ...copy,
        project_slug: entry.project_slug,
        channel,
        status: 'generated',
        source_type: 'changelog',
        source_id: entry.id,
        changelog_entry_id: entry.id,
        task_id: entry.task_id,
        notes: 'Generated from changelog. Review manually before posting.',
      }, db));
    }
  }
  return { created, skipped, scanned: entries.length };
}
