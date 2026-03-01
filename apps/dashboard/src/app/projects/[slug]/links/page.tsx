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
import { Link2, MousePointerClick } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { getAuthenticatedProject } from "../get-project";
import type { ShortLinkRecord } from "@saas-maker/shared-types";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function LinksPage({ params }: Props) {
  const { slug } = await params;
  const { project, token } = await getAuthenticatedProject(slug);

  let links: ShortLinkRecord[] = [];
  let total = 0;

  try {
    const res = await apiFetch(
      `/v1/links/dashboard/${project.id}`,
      {},
      token
    );
    links = res.data ?? [];
    total = res.total ?? 0;
  } catch {
    // Links fetch failed — show empty state
  }

  const totalClicks = links.reduce((sum, link) => sum + link.click_count, 0);
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Links"
        description={`${total} total link${total !== 1 ? "s" : ""}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Links" value={total} icon={Link2} />
        <StatCard
          title="Total Clicks"
          value={totalClicks}
          icon={MousePointerClick}
        />
      </div>

      {links.length > 0 ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Short URL</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="text-right">Clicks</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {links.map((link) => {
                const shortUrl = `${API_URL}/l/${link.slug}`;
                return (
                  <TableRow key={link.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono truncate max-w-[200px]">
                          {shortUrl}
                        </code>
                        <CopyButton value={shortUrl} />
                      </div>
                    </TableCell>
                    <TableCell
                      className="max-w-[300px] truncate text-muted-foreground"
                      title={link.destination}
                    >
                      {link.destination}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {link.title ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {link.click_count.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(link.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <EmptyState
          icon={Link2}
          title="No links yet"
          description="Create short links via the API or CLI to start tracking clicks."
        />
      )}
    </div>
  );
}
