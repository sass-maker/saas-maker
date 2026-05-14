import { DurableObject } from 'cloudflare:workers';
import type { Env, RunEventInput } from './types';
import type { RunRoomEvent, RunRoomStatus } from './run-room-client';

export class DroidRunRoom extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS run_events (
          id TEXT PRIMARY KEY,
          run_id TEXT NOT NULL,
          type TEXT NOT NULL,
          actor TEXT NOT NULL,
          source TEXT NOT NULL,
          message TEXT,
          command TEXT,
          cwd TEXT,
          exit_code INTEGER,
          stdout TEXT,
          stderr TEXT,
          metadata TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_run_events_run_created
          ON run_events(run_id, created_at);
        CREATE TABLE IF NOT EXISTS run_state (
          run_id TEXT PRIMARY KEY,
          last_event_at TEXT,
          event_count INTEGER NOT NULL DEFAULT 0
        );
      `);
    });
  }

  async recordEvent(input: { runId: string; event: RunEventInput }): Promise<RunRoomEvent> {
    const event: RunRoomEvent = {
      id: crypto.randomUUID(),
      run_id: input.runId,
      type: input.event.type,
      actor: input.event.actor ?? 'droid',
      source: input.event.source ?? 'worker',
      message: input.event.message ?? null,
      command: input.event.command ?? null,
      cwd: input.event.cwd ?? null,
      exit_code: input.event.exit_code ?? null,
      stdout: truncate(input.event.stdout),
      stderr: truncate(input.event.stderr),
      metadata: input.event.metadata ?? {},
      created_at: new Date().toISOString(),
    };

    this.ctx.storage.sql.exec(
      `INSERT INTO run_events (
        id, run_id, type, actor, source, message, command, cwd, exit_code, stdout, stderr, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      event.id,
      event.run_id,
      event.type,
      event.actor,
      event.source,
      event.message,
      event.command,
      event.cwd,
      event.exit_code,
      event.stdout,
      event.stderr,
      JSON.stringify(event.metadata),
      event.created_at
    );
    this.ctx.storage.sql.exec(
      `INSERT INTO run_state (run_id, last_event_at, event_count)
       VALUES (?, ?, 1)
       ON CONFLICT(run_id) DO UPDATE SET
         last_event_at = excluded.last_event_at,
         event_count = event_count + 1`,
      input.runId,
      event.created_at
    );

    this.broadcast({ type: 'event', data: event });
    return event;
  }

  async getStatus(runId: string): Promise<RunRoomStatus> {
    const state = this.ctx.storage.sql
      .exec<{
        run_id: string;
        last_event_at: string | null;
        event_count: number;
      }>(`SELECT run_id, last_event_at, event_count FROM run_state WHERE run_id = ?`, runId)
      .toArray()[0];
    return {
      run_id: runId,
      last_event_at: state?.last_event_at ?? null,
      event_count: Number(state?.event_count ?? 0),
      recent_events: await this.listEvents(runId, 50),
    };
  }

  async listEvents(runId: string, limit = 100): Promise<RunRoomEvent[]> {
    const boundedLimit = Math.min(Math.max(limit, 1), 250);
    return this.ctx.storage.sql
      .exec<StoredRunRoomEvent>(
        `SELECT * FROM run_events WHERE run_id = ? ORDER BY created_at ASC LIMIT ?`,
        runId,
        boundedLimit
      )
      .toArray()
      .map(parseStoredEvent);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const runId = url.searchParams.get('run_id') ?? roomRunIdFromUrl(url);

    if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
      server.serializeAttachment({ runId });
      this.ctx.acceptWebSocket(server);
      server.send(JSON.stringify({ type: 'snapshot', data: await this.getStatus(runId) }));
      return new Response(null, { status: 101, webSocket: client });
    }

    return Response.json({ data: await this.getStatus(runId) });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (message === 'ping') {
      ws.send(JSON.stringify({ type: 'pong', at: new Date().toISOString() }));
    }
  }

  private broadcast(payload: unknown): void {
    const text = JSON.stringify(payload);
    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(text);
      } catch {
        socket.close(1011, 'Failed to send Droid run event.');
      }
    }
  }
}

type StoredRunRoomEvent = Omit<RunRoomEvent, 'metadata'> & { metadata: string };

function parseStoredEvent(row: StoredRunRoomEvent): RunRoomEvent {
  let metadata: Record<string, unknown> = {};
  try {
    metadata = JSON.parse(row.metadata) as Record<string, unknown>;
  } catch {
    metadata = {};
  }
  return { ...row, metadata };
}

function roomRunIdFromUrl(url: URL): string {
  const parts = url.pathname.split('/').filter(Boolean);
  return parts.at(-1) ?? 'unknown';
}

function truncate(value: string | undefined): string | null {
  if (value === undefined) return null;
  return value.length > 16000 ? `${value.slice(0, 16000)}\n...[truncated]` : value;
}
