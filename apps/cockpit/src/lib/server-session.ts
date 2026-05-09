import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getLocalDevSession, isLocalAuthBypassEnabled } from "@/lib/local-auth";

type RequestHeaders = Headers | Awaited<ReturnType<typeof headers>>;

export async function getDashboardSession(requestHeaders?: RequestHeaders) {
  const resolvedHeaders = requestHeaders ?? await headers();
  return isLocalAuthBypassEnabled(resolvedHeaders.get("host"))
    ? getLocalDevSession()
    : auth.api.getSession({ headers: resolvedHeaders });
}
