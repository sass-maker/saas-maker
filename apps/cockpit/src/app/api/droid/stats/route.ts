import { droidApiUrl, droidJsonResponse, requireDroidAccess } from '@/app/api/droid/_lib';

export async function GET(req: Request) {
  const denied = await requireDroidAccess();
  if (denied) return denied;

  if (!process.env.DROID_INTERNAL_TOKEN && process.env.NODE_ENV !== 'production') {
    return Response.json({
      data: {
        total: 0,
        by_status: { queued: 0, running: 0, completed: 0, failed: 0 },
        avg_duration_ms: null,
        stale_running: 0,
        idle_running: 0,
        estimated_compute_seconds: 0,
        recent: [],
      },
      error: 'DROID_INTERNAL_TOKEN is not configured; Droid stats are hidden in local dev.',
    });
  }

  const incoming = new URL(req.url);
  const upstream = new URL(droidApiUrl('/v0/stats'));
  for (const key of ['project_slug', 'limit']) {
    const value = incoming.searchParams.get(key);
    if (value) upstream.searchParams.set(key, value);
  }

  return droidJsonResponse(upstream);
}
