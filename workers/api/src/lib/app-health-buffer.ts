import { createAppHealthClient } from '@saas-maker/app-health';
import type { AppHealthClient, AppHealthClientOptions, EventInput } from '@saas-maker/app-health';

// Shared state contains only bounded endpoint summaries, never a request,
// response, SDK client, fetch or delivery promise. Each drain owns its I/O.
export function createWorkerHealthBuffer(delayMs = 5000, batchSize = 50) {
  const buffers = new WeakMap<object, { events: EventInput[]; scheduled: boolean }>();
  return (env: object, options: AppHealthClientOptions): AppHealthClient => {
    let buffer = buffers.get(env);
    if (!buffer) {
      buffer = { events: [], scheduled: false };
      buffers.set(env, buffer);
    }
    const pending = buffer;
    const client = createAppHealthClient({ ...options, disableTimer: true });
    const flush = async () => {
      const drain = async () => {
        const events = pending.events.splice(0);
        if (!events.length) return;
        const delivery = createAppHealthClient({ ...options, disableTimer: true });
        for (const event of events) delivery.record(event);
        await delivery.flush();
      };
      if (pending.events.length >= batchSize) return drain();
      if (pending.scheduled || !pending.events.length) return;
      pending.scheduled = true;
      // Hono attaches the returned promise to this request's waitUntil.
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
      pending.scheduled = false;
      await drain();
    };
    return {
      ...client,
      record(event) {
        if (pending.events.length < batchSize * 2) {
          pending.events.push({ ...event, timestamp: event.timestamp ?? Date.now() });
        }
      },
      flush,
      close: flush,
    };
  };
}
