import { droidApiUrl, droidJsonResponse, requireDroidAccess } from '@/app/api/droid/_lib';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireDroidAccess();
  if (denied) return denied;
  const { id } = await params;
  const body = await req.text();
  return droidJsonResponse(droidApiUrl(`/v0/runs/${encodeURIComponent(id)}/reconcile`), {
    method: 'POST',
    body: body || '{}',
  });
}
