import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { CopyButton } from "@/components/copy-button";
import { WaitlistActions } from "./waitlist-actions";
import { Users, ExternalLink } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { getAuthenticatedProject } from "../get-project";
import type { WaitlistEntryRecord } from "@saas-maker/shared-types";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function WaitlistPage({ params }: Props) {
  const { slug } = await params;
  const { project, token } = await getAuthenticatedProject(slug);

  let entries: WaitlistEntryRecord[] = [];
  let total = 0;

  try {
    const res = await apiFetch(
      `/v1/waitlist?project_id=${project.id}`,
      {},
      token
    );
    entries = res.data ?? [];
    total = res.total ?? 0;
  } catch {
    // Waitlist fetch failed — show empty state
  }

  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const publicWaitlistUrl = `${SITE_URL}/w/${project.slug}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Waitlist"
        description={`${total} total signup${total !== 1 ? "s" : ""}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Signups" value={total} icon={Users} />
      </div>

      {/* Public waitlist link */}
      <div className="flex items-center gap-2 rounded-md border px-3 py-2">
        <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm text-muted-foreground">Public page:</span>
        <code className="flex-1 text-sm font-mono truncate">{publicWaitlistUrl}</code>
        <CopyButton value={publicWaitlistUrl} />
      </div>

      {entries.length > 0 ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Position</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-mono text-muted-foreground">
                    #{entry.position}
                  </TableCell>
                  <TableCell className="font-medium">{entry.email}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {entry.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(entry.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell>
                    <WaitlistActions
                      entryId={entry.id}
                      projectId={project.id}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <EmptyState
          icon={Users}
          title="No signups yet"
          description="Share your waitlist link or embed the widget to start collecting signups."
        />
      )}
    </div>
  );
}
