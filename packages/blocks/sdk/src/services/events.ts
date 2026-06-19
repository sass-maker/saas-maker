import { HttpClient } from '../http';

// ---- Types ----

export interface FleetEventInput {
  /** Which spoke emitted this, e.g. 'reel-pipeline'. */
  product: string;
  /** Event type, e.g. 'reel.rendered', 'audit.completed'. */
  type: string;
  /** Opaque JSON payload — never coupled to the server table shape. */
  payload?: Record<string, unknown>;
  /** Optional fleet-project linkage. */
  projectSlug?: string;
  /** Dedupe key for safe outbox retries. Auto-generated if omitted. */
  idempotencyKey?: string;
  /** Client event time (ISO). Defaults to now. */
  occurredAt?: string;
}

export interface EmitResponse {
  accepted: number;
  deduped: number;
  received: number;
}

interface WireEvent {
  product: string;
  type: string;
  payload: Record<string, unknown>;
  project_slug?: string;
  schema_version: number;
  idempotency_key: string;
  occurred_at: string;
}

function toWire(input: FleetEventInput): WireEvent {
  return {
    product: input.product,
    type: input.type,
    payload: input.payload ?? {},
    project_slug: input.projectSlug,
    schema_version: 1,
    idempotency_key: input.idempotencyKey ?? crypto.randomUUID(),
    occurred_at: input.occurredAt ?? new Date().toISOString(),
  };
}

// ---- Service ----

/**
 * Publish-up events to the fleet system-of-record (POST /v1/events).
 *
 * This is the transport primitive. A *durable* outbox (local buffer + retry so
 * the caller never blocks on the hub) is host-specific — back it with the
 * spoke's own store (D1 row / local SQLite / a scheduled job) and call emit()
 * on flush. The client-supplied idempotency key makes retries safe.
 */
export class EventsService {
  constructor(private http: HttpClient) {}

  /** Emit a single event. Uses the session/Bearer token. */
  emit(event: FleetEventInput): Promise<EmitResponse> {
    return this.http.request<EmitResponse>('POST', '/v1/events', toWire(event), {
      auth: 'session',
    });
  }

  /** Emit a batch of events in one request (max 100). */
  emitBatch(events: FleetEventInput[]): Promise<EmitResponse> {
    return this.http.request<EmitResponse>('POST', '/v1/events', events.map(toWire), {
      auth: 'session',
    });
  }
}
