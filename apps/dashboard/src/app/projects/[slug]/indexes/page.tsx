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
import { Database, FileText, Cpu } from "lucide-react";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { apiFetch, getServerToken, getProjectBySlug } from "@/lib/api";
import type { IndexRecord } from "@saas-maker/shared-types";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function IndexesPage({ params }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { slug } = await params;
  const token = await getServerToken();

  const project = await getProjectBySlug(slug, token);
  if (!project) notFound();

  let indexes: (IndexRecord & { document_count: number })[] = [];

  try {
    const res = await apiFetch(
      `/v1/indexes/dashboard/${project.id}`,
      {},
      token
    );
    indexes = res.data ?? [];
  } catch {
    // Indexes fetch failed — show empty state
  }

  const totalDocs = indexes.reduce((sum, idx) => sum + idx.document_count, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Indexes"
        description={`${indexes.length} total index${indexes.length !== 1 ? "es" : ""}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard title="Total Indexes" value={indexes.length} icon={Database} />
        <StatCard title="Total Documents" value={totalDocs} icon={FileText} />
        <StatCard
          title="Embedding Model"
          value={project.embedding_model ?? "Not set"}
          icon={Cpu}
        />
      </div>

      {indexes.length > 0 ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>External ID</TableHead>
                <TableHead>Documents</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {indexes.map((index) => (
                <TableRow key={index.id}>
                  <TableCell className="font-medium">{index.name}</TableCell>
                  <TableCell className="text-muted-foreground font-mono">
                    {index.external_id ?? "\u2014"}
                  </TableCell>
                  <TableCell>{index.document_count}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(index.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <EmptyState
          icon={Database}
          title="No indexes yet"
          description="Create indexes via the API or CLI to start building vector memory."
        />
      )}
    </div>
  );
}
