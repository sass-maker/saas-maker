import { Hono } from 'hono';
import { Bindings, Variables } from '../types';
import { requireSession } from '../middleware/auth';

// Fleet events: the append-only return path where spokes publish results/telemetry
// up to saas-maker (the system-of-record). Spokes authenticate with the same
// Bearer token they already use (session or sm_ CLI token); owner_id scopes tenancy.
// See docs/architecture/decisions/2026-06-19-fleet-events-hub-spec.md

const events = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const MAX_BATCH = 100;

function cleanString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

interface NormalizedEvent {
  product: string;
  type: string;
  project_slug: string | null;
  payload: string;
  schema_version: number;
  idempotency_key: string;
  occurred_at: string | null;
}

/** Validate + normalize one inbound event. Returns an error string or the row. */
function normalizeEvent(raw: unknown): { error: string } | NormalizedEvent {
  if (!raw || typeof raw !== 'object') return { error: 'event must be an object' };
  const input = raw as Record<string, unknown>;

  const product = cleanString(input.product);
  if (!product) return { error: 'product is required' };
  const type = cleanString(input.type);
  if (!type) return { error: 'type is required' };

  // payload stays opaque JSON — stringify whatever object was sent.
  let payload = '{}';
  if (input.payload !== undefined && input.payload !== null) {
    if (typeof input.payload !== 'object') return { error: 'payload must be an object' };
    payload = JSON.stringify(input.payload);
  }

  const schemaVersionRaw = input.schema_version;
  const schema_version =
    typeof schemaVersionRaw === 'number' && Number.isFinite(schemaVersionRaw)
      ? Math.trunc(schemaVersionRaw)
      : 1;

  return {
    product,
    type,
    project_slug: cleanString(input.project_slug),
    payload,
    schema_version,
    // Client-supplied idempotency key dedupes outbox retries; fall back to a uuid
    // (that single call is then non-idempotent, but never errors).
    idempotency_key: cleanString(input.idempotency_key) ?? crypto.randomUUID(),
    occurred_at: cleanString(input.occurred_at),
  };
}

events.use('*', requireSession);

// POST /v1/events — append one event or a batch. Idempotent on (owner_id, idempotency_key).
events.post('/', async (c) => {
  const userId = c.get('userId')!;
  const body = await c.req.json().catch(() => null);
  if (body === null) return c.json({ error: 'invalid JSON body' }, 400);

  const rawItems = Array.isArray(body) ? body : [body];
  if (rawItems.length === 0) return c.json({ error: 'no events provided' }, 400);
  if (rawItems.length > MAX_BATCH) {
    return c.json({ error: `batch too large: max ${MAX_BATCH} events per request` }, 400);
  }

  const rows: NormalizedEvent[] = [];
  for (let i = 0; i < rawItems.length; i++) {
    const result = normalizeEvent(rawItems[i]);
    if ('error' in result) return c.json({ error: `event[${i}]: ${result.error}` }, 400);
    rows.push(result);
  }

  const statements = rows.map((row) =>
    c.env.DB.prepare(
      `INSERT INTO fleet_events (
        id, owner_id, product, project_slug, type, payload, schema_version, idempotency_key, occurred_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(owner_id, idempotency_key) DO NOTHING`
    ).bind(
      crypto.randomUUID(),
      userId,
      row.product,
      row.project_slug,
      row.type,
      row.payload,
      row.schema_version,
      row.idempotency_key,
      row.occurred_at
    )
  );

  const results = await c.env.DB.batch(statements);
  const accepted = results.reduce((sum, r) => sum + (r.meta?.changes ?? 0), 0);
  return c.json({ accepted, deduped: rows.length - accepted, received: rows.length }, 201);
});

// GET /v1/events — read the union (Cockpit/analytics only). Filters: product, type, since, limit.
events.get('/', async (c) => {
  const userId = c.get('userId')!;
  const product = cleanString(c.req.query('product'));
  const type = cleanString(c.req.query('type'));
  const since = cleanString(c.req.query('since')); // ISO timestamp lower bound on created_at

  const conditions = ['owner_id = ?'];
  const values: unknown[] = [userId];
  if (product) {
    conditions.push('product = ?');
    values.push(product);
  }
  if (type) {
    conditions.push('type = ?');
    values.push(type);
  }
  if (since) {
    conditions.push('created_at >= ?');
    values.push(since);
  }

  const limit = Math.min(
    Math.max(Number.parseInt(c.req.query('limit') ?? '100', 10) || 100, 1),
    500
  );
  values.push(limit);

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM fleet_events WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT ?`
  )
    .bind(...values)
    .all();

  return c.json({ data: results ?? [] });
});

export { events };
