import type { Env, RunEventInput } from './types';

export interface RunRoomEvent {
  id: string;
  run_id: string;
  type: string;
  actor: string;
  source: string;
  message: string | null;
  command: string | null;
  cwd: string | null;
  exit_code: number | null;
  stdout: string | null;
  stderr: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface RunRoomStatus {
  run_id: string;
  last_event_at: string | null;
  event_count: number;
  recent_events: RunRoomEvent[];
}

type RunRoomStub = {
  recordEvent(input: { runId: string; event: RunEventInput }): Promise<RunRoomEvent>;
  getStatus(runId: string): Promise<RunRoomStatus>;
  fetch(request: Request): Promise<Response>;
};

type RunRoomNamespace = DurableObjectNamespace & {
  getByName(name: string): RunRoomStub;
};

export async function recordRunRoomEvent(
  env: Env,
  runId: string,
  event: RunEventInput
): Promise<void> {
  const room = getRunRoom(env, runId);
  if (!room) return;
  await room.recordEvent({ runId, event });
}

export async function getRunRoomStatus(env: Env, runId: string): Promise<RunRoomStatus | null> {
  const room = getRunRoom(env, runId);
  return room ? room.getStatus(runId) : null;
}

export function fetchRunRoom(env: Env, runId: string, request: Request): Promise<Response> | null {
  const room = getRunRoom(env, runId);
  if (!room) return null;
  const url = new URL(request.url);
  url.searchParams.set('run_id', runId);
  return room.fetch(new Request(url, request));
}

function getRunRoom(env: Env, runId: string): RunRoomStub | null {
  const namespace = env.DROID_RUN_ROOMS as RunRoomNamespace | undefined;
  return namespace ? (namespace.getByName(runId) as unknown as RunRoomStub) : null;
}
