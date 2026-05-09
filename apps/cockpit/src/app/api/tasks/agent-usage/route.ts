import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { isLocalAuthBypassEnabled } from "@/lib/local-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const requestHeaders = await headers();
  if (!isLocalAuthBypassEnabled(requestHeaders.get("host"))) {
    return NextResponse.json({ error: "Agent usage is only available locally" }, { status: 403 });
  }

  try {
    const filePath = path.join(process.cwd(), ".symphony", "agent-usage.json");
    return NextResponse.json({ data: JSON.parse(fs.readFileSync(filePath, "utf8")) });
  } catch {
    return NextResponse.json({ data: null });
  }
}
