import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getFleetErrors } from "@/lib/posthog-server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") || "20");

  try {
    const errors = await getFleetErrors(limit);
    return NextResponse.json({ errors });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch error feed", detail: String(err) },
      { status: 500 }
    );
  }
}
