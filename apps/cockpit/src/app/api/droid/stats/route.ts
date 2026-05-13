import { droidApiUrl, droidJsonResponse, requireDroidAccess } from "@/app/api/droid/_lib";

export async function GET(req: Request) {
  const denied = await requireDroidAccess();
  if (denied) return denied;

  const incoming = new URL(req.url);
  const upstream = new URL(droidApiUrl("/v0/stats"));
  for (const key of ["project_slug", "limit"]) {
    const value = incoming.searchParams.get(key);
    if (value) upstream.searchParams.set(key, value);
  }

  return droidJsonResponse(upstream);
}
