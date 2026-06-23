import { redirect } from 'next/navigation';
import { getDashboardSession } from '@/lib/server-session';
import { apiFetch, getServerToken } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { StandardsEditor } from '@/components/standards/StandardsEditor';
import type { StandardsConfig } from '@/components/standards/StandardsEditor';

export const dynamic = 'force-dynamic';

export default async function StandardsPage() {
  const session = await getDashboardSession();
  if (!session?.user) redirect('/login');

  const token = await getServerToken();

  let initialConfig: StandardsConfig | null = null;
  let fetchError: string | null = null;

  try {
    const res = await apiFetch('/v1/standards', {}, token);
    initialConfig = res.data ?? res ?? null;
  } catch (e) {
    fetchError = e instanceof Error ? e.message : 'Failed to load standards';
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Standards"
        description="Manage ESLint rules, TypeScript options, and Prettier settings across your fleet."
      />
      <StandardsEditor initialConfig={initialConfig} fetchError={fetchError} />
    </div>
  );
}
