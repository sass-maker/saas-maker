import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Users } from "lucide-react";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { apiFetch, getServerToken } from "@/lib/api";
import type { ProjectRecord, WaitlistEntryRecord } from "@saasmaker/shared-types";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function WaitlistPage({ params }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { slug } = await params;
  const token = await getServerToken();

  let project: ProjectRecord | undefined;

  try {
    const res = await apiFetch("/v1/projects", {}, token);
    const projects: ProjectRecord[] = res.data ?? [];
    project = projects.find((p) => p.slug === slug);
  } catch {
    // Auth failed — fall through to notFound
  }

  if (!project) notFound();

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

  const snippet = `<script defer src="https://cdn.saasmaker.dev/a.js" data-project="${project.api_key}"></script>

// Or use the API directly:
// POST /v1/waitlist with X-Project-Key header
// Body: { "email": "user@example.com", "name": "Optional Name" }`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Waitlist"
        description={`${total} total signup${total !== 1 ? "s" : ""}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Signups" value={total} icon={Users} />
      </div>

      {/* Quick Setup */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Quick Setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono">
              {project.api_key}
            </code>
            <CopyButton value={project.api_key} />
          </div>
          <pre className="rounded bg-muted p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
            {snippet}
          </pre>
        </CardContent>
      </Card>

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
