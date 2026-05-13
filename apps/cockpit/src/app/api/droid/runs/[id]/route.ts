import { droidApiUrl, droidJsonResponse, requireDroidAccess } from "@/app/api/droid/_lib";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireDroidAccess();
  if (denied) return denied;
  const { id } = await params;
  return droidJsonResponse(droidApiUrl(`/v0/runs/${encodeURIComponent(id)}`));
}
