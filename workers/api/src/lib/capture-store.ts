export type CaptureKind = 'newsletter' | 'waitlist';

export interface CaptureJoin {
  id: string;
  projectId: string;
  kind: CaptureKind;
  email: string;
  source: string;
  consentVersion: string;
  consentText: string;
  consentedAt: string;
}

export interface CaptureRecord {
  id: string;
  project_id: string;
  kind: CaptureKind;
  email_normalized: string;
  state: 'active' | 'unsubscribed';
}

export interface CaptureListRecord {
  id: string;
  kind: CaptureKind;
  email: string;
  source: string;
  state: 'active' | 'unsubscribed';
  consent_version: string;
  consent_text: string;
  consented_at: string;
  created_at: string;
}

/** The UPSERT makes a repeat join inert and an unsubscribed address rejoin once. */
export async function joinCapture(
  db: D1Database,
  input: CaptureJoin
): Promise<{ id: string; joined: boolean }> {
  const normalized = input.email.trim().toLowerCase();
  const result = await db
    .prepare(
      `INSERT INTO capture_subscriptions
       (id, project_id, kind, email, email_normalized, consent_version, consent_text, consented_at, source, state, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
       ON CONFLICT(project_id, kind, email_normalized) DO UPDATE SET
         id = excluded.id,
         email = excluded.email,
         consent_version = excluded.consent_version,
         consent_text = excluded.consent_text,
         consented_at = excluded.consented_at,
         source = excluded.source,
         state = 'active',
         created_at = excluded.created_at,
         updated_at = excluded.updated_at
       WHERE capture_subscriptions.state = 'unsubscribed'`
    )
    .bind(
      input.id,
      input.projectId,
      input.kind,
      normalized,
      normalized,
      input.consentVersion,
      input.consentText,
      input.consentedAt,
      input.source,
      input.consentedAt
    )
    .run();
  const record = await db
    .prepare(
      'SELECT id FROM capture_subscriptions WHERE project_id = ? AND kind = ? AND email_normalized = ?'
    )
    .bind(input.projectId, input.kind, normalized)
    .first<{ id: string }>();
  if (!record) throw new Error('Subscription write did not persist');
  return { id: record.id, joined: (result.meta.changes ?? 0) > 0 };
}

export async function getCaptureById(db: D1Database, id: string): Promise<CaptureRecord | null> {
  return db
    .prepare(
      'SELECT id, project_id, kind, email_normalized, state FROM capture_subscriptions WHERE id = ?'
    )
    .bind(id)
    .first<CaptureRecord>();
}

export async function unsubscribeCapture(db: D1Database, id: string): Promise<boolean> {
  const result = await db
    .prepare(
      "UPDATE capture_subscriptions SET state = 'unsubscribed', updated_at = ? WHERE id = ? AND state = 'active'"
    )
    .bind(new Date().toISOString(), id)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export async function listCapture(
  db: D1Database,
  projectId: string,
  kind?: CaptureKind,
  cursor?: string
): Promise<{ data: CaptureListRecord[]; next_cursor: string | null }> {
  const conditions = ['project_id = ?', "state = 'active'"];
  const values: string[] = [projectId];
  if (kind) {
    conditions.push('kind = ?');
    values.push(kind);
  }
  if (cursor) {
    const boundary = await db
      .prepare('SELECT created_at FROM capture_subscriptions WHERE id = ? AND project_id = ?')
      .bind(cursor, projectId)
      .first<{ created_at: string }>();
    if (!boundary) throw new RangeError('Invalid subscription cursor');
    conditions.push('(created_at < ? OR (created_at = ? AND id < ?))');
    values.push(boundary.created_at, boundary.created_at, cursor);
  }
  const { results } = await db
    .prepare(
      `SELECT id, kind, email, source, state, consent_version, consent_text, consented_at, created_at
       FROM capture_subscriptions WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC, id DESC LIMIT 101`
    )
    .bind(...values)
    .all<CaptureListRecord>();
  const data = results.slice(0, 100);
  return { data, next_cursor: results.length > 100 ? (data.at(-1)?.id ?? null) : null };
}
