import { WorkerEntrypoint } from 'cloudflare:workers';
import { getDailyCaptureCounts } from '../lib/daily-capture-counts';
import type { Bindings } from '../types';

/** Internal RPC surface for trusted, explicitly bound Workers only. */
export class PrivateMetrics extends WorkerEntrypoint<Bindings> {
  getDailyCaptureCounts(input: { date: string; catalogIds: string[] }) {
    return getDailyCaptureCounts(this.env.DB, input.date, input.catalogIds);
  }
}
