import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { EmptyState } from '@/components/empty-state';
import { ChangelogActions } from './changelog-actions';
import { CreateChangelogDialog } from './create-changelog-dialog';
import { Megaphone, FileText, Eye, EyeOff } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getAuthenticatedProject } from '../get-project';
import type { ChangelogEntryRecord, ChangelogEntryType } from '@saas-maker/contracts';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ slug: string }>;
}

const typeBadge: Record<
  ChangelogEntryType,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
> = {
  feature: { label: 'Feature', variant: 'default' },
  improvement: { label: 'Improvement', variant: 'secondary' },
  fix: { label: 'Fix', variant: 'outline' },
  breaking: { label: 'Breaking', variant: 'destructive' },
};

export default async function ChangelogPage({ params }: Props) {
  const { slug } = await params;
  const { project, token } = await getAuthenticatedProject(slug);

  let entries: ChangelogEntryRecord[] = [];
  let total = 0;
  let stats = { total: 0, published: 0, drafts: 0 };

  try {
    const res = await apiFetch(`/v1/changelog/dashboard/${project.id}`, {}, token);
    entries = res.data ?? [];
    total = res.total ?? 0;
    stats = res.stats ?? stats;
  } catch {
    // Fetch failed
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Changelog"
        description={`${total} total entr${total !== 1 ? 'ies' : 'y'}`}
        action={<CreateChangelogDialog projectId={project.id} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard title="Total Entries" value={stats.total} icon={FileText} />
        <StatCard title="Published" value={stats.published} icon={Eye} />
        <StatCard title="Drafts" value={stats.drafts} icon={EyeOff} />
      </div>

      {entries.length > 0 ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => {
                const badge = typeBadge[entry.type];
                return (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <div className="font-medium">{entry.title}</div>
                      <p className="text-xs text-muted-foreground truncate max-w-xs">
                        {entry.content}
                      </p>
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm">
                      {entry.version ?? '--'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={entry.published ? 'default' : 'secondary'}>
                        {entry.published ? 'Published' : 'Draft'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(entry.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell>
                      <ChangelogActions
                        entryId={entry.id}
                        projectId={project.id}
                        isPublished={entry.published}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <EmptyState
          icon={Megaphone}
          title="No changelog entries yet"
          description="Create your first changelog entry to keep your users informed about updates and improvements."
        />
      )}
    </div>
  );
}
