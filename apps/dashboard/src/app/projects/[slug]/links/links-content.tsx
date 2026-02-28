"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { CopyButton } from "@/components/copy-button";
import { Link2, Trash2, Loader2 } from "lucide-react";
import { apiFetchClient, getClientToken } from "@/lib/api-client";
import type { ShortLinkRecord } from "@saasmaker/shared-types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";

interface LinksContentProps {
  projectId: string;
  apiKey: string;
}

export function LinksContent({ projectId, apiKey }: LinksContentProps) {
  const router = useRouter();
  const [links, setLinks] = useState<ShortLinkRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLinks() {
      try {
        const token = await getClientToken();
        const res = await apiFetchClient<{
          data: ShortLinkRecord[];
          total: number;
        }>(`/v1/links/dashboard/${projectId}`, token);
        setLinks(res.data ?? []);
      } catch (e) {
        console.error("Failed to fetch links:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchLinks();
  }, [projectId]);

  async function handleDelete(linkId: string) {
    if (!confirm("Are you sure you want to delete this link?")) return;
    setDeletingId(linkId);
    try {
      await fetch(`${API_BASE}/v1/links/${linkId}`, {
        method: "DELETE",
        headers: { "X-Project-Key": apiKey },
      });
      setLinks((prev) => prev.filter((l) => l.id !== linkId));
      router.refresh();
    } catch (e) {
      console.error("Failed to delete link:", e);
    } finally {
      setDeletingId(null);
    }
  }

  function truncate(str: string, max: number) {
    return str.length > max ? str.slice(0, max) + "..." : str;
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  if (loading) return null;

  if (links.length === 0) {
    return (
      <EmptyState
        icon={Link2}
        title="No short links yet"
        description="Create your first short link to start tracking clicks and sharing URLs."
      />
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Short URL</TableHead>
            <TableHead>Destination</TableHead>
            <TableHead>Title</TableHead>
            <TableHead className="text-right">Clicks</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {links.map((link) => (
            <TableRow key={link.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono text-primary">
                    /r/{link.slug}
                  </code>
                  <CopyButton
                    value={`${typeof window !== "undefined" ? window.location.origin : ""}/r/${link.slug}`}
                  />
                </div>
              </TableCell>
              <TableCell
                className="text-muted-foreground max-w-[200px] truncate"
                title={link.destination}
              >
                {truncate(link.destination, 40)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {link.title ?? "\u2014"}
              </TableCell>
              <TableCell className="text-right font-mono">
                {link.click_count.toLocaleString()}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(link.created_at)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {link.expires_at ? formatDate(link.expires_at) : "Never"}
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(link.id)}
                  disabled={deletingId === link.id}
                  className="h-8 w-8"
                >
                  {deletingId === link.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
