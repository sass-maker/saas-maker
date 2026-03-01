import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CliAuthApproval } from "./cli-auth-approval";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ code?: string }>;
}

export default async function CliAuthPage({ searchParams }: Props) {
  const { code } = await searchParams;
  const session = await auth();
  if (!session?.user) {
    const callbackUrl = code ? `/cli/auth?code=${code}` : "/cli/auth";
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40">
      <CliAuthApproval code={code} userEmail={session.user.email ?? "Unknown"} />
    </div>
  );
}
