import { HttpClient } from '../http';

// ---- Types ----

export interface FleetTask {
  id: string;
  title: string;
  description: string | null;
  capability: string | null;
  project_slug: string | null;
  status: string;
  priority: string;
  task_type: string;
  attempts: number;
  [key: string]: unknown;
}

export interface DrainOptions {
  /** Worker identity, e.g. 'psi-swarm@laptop'. Owns the lease. */
  worker: string;
  /** Only claim tasks of this capability (omit to claim any). */
  capability?: string;
  /** Lease seconds per task (30–3600, default 900). */
  leaseSeconds?: number;
  /** Stop after this many tasks (default: drain until empty). */
  maxTasks?: number;
  /** Does the work. Return a string to attach as the result comment. Throw to fail the task. */
  handler: (task: FleetTask) => Promise<string | void> | string | void;
}

export interface DrainResult {
  completed: number;
  failed: number;
  /** True if the loop stopped because the hub was unreachable (not because the queue was empty). */
  hubUnavailable: boolean;
}

// ---- Service ----

/**
 * Fleet worker client — the wake-loop every spoke embeds. On wake, `drain()`
 * claims pending tasks for a capability, runs the handler, and reports back.
 *
 * Designed to be OPTIONAL: a service constructs this only when a saas-maker token
 * is configured, and `drain()` never throws on hub/network errors — it just stops
 * and reports `hubUnavailable`. So a service works standalone, and "just works"
 * (drains the queue) the moment it can reach the hub. The hub is never a hard
 * dependency.
 */
export class WorkerService {
  constructor(private http: HttpClient) {}

  /** Atomically claim the next runnable task, or null if the queue is empty. */
  async claim(opts: { worker: string; capability?: string; leaseSeconds?: number }): Promise<FleetTask | null> {
    const res = await this.http.requestRaw(
      'POST',
      '/v1/tasks/claim',
      { worker: opts.worker, capability: opts.capability, lease_seconds: opts.leaseSeconds },
      { auth: 'session' },
    );
    if (res.status === 204) return null;
    return ((await res.json()) as { data: FleetTask }).data;
  }

  /** Extend the lease on an in-flight task (call periodically from long handlers). */
  heartbeat(id: string, worker: string, leaseSeconds?: number): Promise<{ ok: true }> {
    return this.http.request('POST', `/v1/tasks/${encodeURIComponent(id)}/heartbeat`, { worker, lease_seconds: leaseSeconds }, { auth: 'session' });
  }

  /** Mark a claimed task done; optional `result` is stored as an agent comment. */
  complete(id: string, worker: string, result?: string): Promise<{ data: FleetTask }> {
    return this.http.request('POST', `/v1/tasks/${encodeURIComponent(id)}/complete`, { worker, result }, { auth: 'session' });
  }

  /** Report failure; the hub requeues (under max_attempts) or dead-letters. */
  fail(id: string, worker: string, error?: string, maxAttempts?: number): Promise<{ data: FleetTask; outcome: { dead_letter: boolean; requeued: boolean; attempts: number } }> {
    return this.http.request('POST', `/v1/tasks/${encodeURIComponent(id)}/fail`, { worker, error, max_attempts: maxAttempts }, { auth: 'session' });
  }

  /**
   * The wake-loop: claim → handle → complete/fail, until the queue is empty,
   * `maxTasks` is reached, or the hub becomes unreachable. Never throws — a hub
   * outage simply ends the drain with `hubUnavailable: true`, so the calling
   * service keeps running standalone.
   */
  async drain(opts: DrainOptions): Promise<DrainResult> {
    const max = opts.maxTasks ?? Number.POSITIVE_INFINITY;
    let completed = 0;
    let failed = 0;

    while (completed + failed < max) {
      let task: FleetTask | null;
      try {
        task = await this.claim({ worker: opts.worker, capability: opts.capability, leaseSeconds: opts.leaseSeconds });
      } catch {
        return { completed, failed, hubUnavailable: true }; // hub down → stop quietly, service lives on
      }
      if (!task) break; // queue empty

      try {
        const result = await opts.handler(task);
        await this.complete(task.id, opts.worker, typeof result === 'string' ? result : undefined);
        completed++;
      } catch (err) {
        failed++;
        try {
          await this.fail(task.id, opts.worker, err instanceof Error ? err.message : String(err));
        } catch {
          // lease already lost/reclaimed, or hub down — leave it for the next wake/reaper
        }
      }
    }

    return { completed, failed, hubUnavailable: false };
  }
}
