import { getDashboardSession } from '@/lib/server-session';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { CliAuthApproval } from './cli-auth-approval';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ code?: string; source?: string }>;
}

export default async function CliAuthPage({ searchParams }: Props) {
  const { code, source } = await searchParams;
  const requestHeaders = await headers();
  const session = await getDashboardSession(requestHeaders);
  if (!session?.user) {
    const params = new URLSearchParams();
    if (code) params.set('code', code);
    if (source) params.set('source', source);
    const callbackUrl = params.toString() ? `/cli/auth?${params.toString()}` : '/cli/auth';
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40">
      <CliAuthApproval code={code} source={source} userEmail={session.user.email ?? 'Unknown'} />
    </div>
  );
}
