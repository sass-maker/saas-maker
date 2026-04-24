import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { apiFetchAuthed } from '@/lib/api-client';
import { FleetMatrix } from '@/components/fleet/FleetMatrix';

export const dynamic = 'force-dynamic';

export default async function FleetPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  let projects = [];
  let error = null;
  try {
    const res = await apiFetchAuthed<{ data: any[] }>('/v1/fleet/metadata');
    projects = res.data ?? [];
  } catch (e) {
    error = 'Could not load fleet data. Run `fnd fleet scan` to populate.';
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Fleet Matrix</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tooling overview across all your projects. Run <code className="bg-muted px-1 rounded text-xs">fnd fleet scan</code> to refresh.
          </p>
        </div>
      </div>
      {error ? (
        <div className="rounded-lg border border-yellow-800 bg-yellow-950/20 p-4 text-sm text-yellow-400">{error}</div>
      ) : (
        <FleetMatrix projects={projects} />
      )}
    </div>
  );
}
