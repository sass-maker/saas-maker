import Link from "next/link";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { FormActions } from "./form-actions";
import { ClipboardList, Plus, FileText, BarChart3 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { getAuthenticatedProject } from "../get-project";
import type { FormRecord } from "@saas-maker/shared-types";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

const statusBadge: Record<
  FormRecord["status"],
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  draft: { label: "Draft", variant: "secondary" },
  published: { label: "Published", variant: "default" },
  closed: { label: "Closed", variant: "outline" },
};

export default async function FormsPage({ params }: Props) {
  const { slug } = await params;
  const { project, token } = await getAuthenticatedProject(slug);

  let forms: FormRecord[] = [];
  let total = 0;

  try {
    const res = await apiFetch(
      `/v1/forms/dashboard/${project.id}`,
      {},
      token
    );
    forms = res.data ?? [];
    total = res.total ?? 0;
  } catch {
    // Fetch failed
  }

  const published = forms.filter((f) => f.status === "published").length;
  const totalResponses = forms.reduce(
    (sum: number, f: FormRecord & { response_count?: number }) =>
      sum + (f.response_count ?? 0),
    0
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Forms"
        description={`${total} total form${total !== 1 ? "s" : ""}`}
        action={
          <Button asChild>
            <Link href={`/projects/${slug}/forms/new`}>
              <Plus />
              Create Form
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard title="Total Forms" value={total} icon={ClipboardList} />
        <StatCard title="Published" value={published} icon={FileText} />
        <StatCard title="Total Responses" value={totalResponses} icon={BarChart3} />
      </div>

      {forms.length > 0 ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {forms.map((form) => {
                const badge = statusBadge[form.status];
                return (
                  <TableRow key={form.id}>
                    <TableCell>
                      <Link
                        href={`/projects/${slug}/forms/${form.id}`}
                        className="hover:underline"
                      >
                        <div className="font-medium">{form.title}</div>
                      </Link>
                      {form.description && (
                        <p className="text-xs text-muted-foreground truncate max-w-xs">
                          {form.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm">
                      {form.slug}
                    </TableCell>
                    <TableCell>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(form.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell>
                      <FormActions
                        formId={form.id}
                        projectId={project.id}
                        projectSlug={slug}
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
          icon={ClipboardList}
          title="No forms yet"
          description="Create your first form to start collecting structured responses from your users."
          action={
            <Button asChild>
              <Link href={`/projects/${slug}/forms/new`}>
                <Plus />
                Create Form
              </Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
