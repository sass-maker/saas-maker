import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
} from "@saas-maker/ui";
import { Plus, Search, Database, Trash2, ArrowLeft } from "lucide-react";
import { getAuthenticatedProject } from "../../get-project";
import { apiFetchAuthed } from "@/lib/api-client";
import Link from "next/link";

interface DocumentRow {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface IndexDetail {
  id: string;
  name: string;
  external_id: string | null;
  project_id: string;
}

async function DocumentsList({ indexId }: { indexId: string }) {
  try {
    const { data: documents } = await apiFetchAuthed<{ data: DocumentRow[] }>(
      `/v1/knowledge/indexes/${indexId}/documents`
    );

    if (documents.length === 0) {
      return (
        <div className="py-12 text-center text-muted-foreground border rounded-md bg-muted/20">
          No documents in this index yet.
        </div>
      );
    }

    return (
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2">Content Preview</th>
              <th className="px-3 py-2">Metadata</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2 w-[100px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr key={doc.id} className="border-t">
                <td className="px-3 py-2 max-w-md truncate font-medium">{doc.content}</td>
                <td className="px-3 py-2 text-xs font-mono">{JSON.stringify(doc.metadata)}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(doc.created_at).toLocaleDateString()}
                </td>
                <td className="px-3 py-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  } catch {
    return <div className="text-destructive p-4 border border-destructive/20 bg-destructive/5 rounded-md">Failed to load documents.</div>;
  }
}

export default async function IndexDetailPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id: indexId } = await params;
  const { project } = await getAuthenticatedProject(slug);

  const { data: indexes } = await apiFetchAuthed<{ data: IndexDetail[] }>(
    `/v1/knowledge/indexes?project_id=${project.id}`
  );
  const index = indexes.find(i => i.id === indexId);

  if (!index) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <h2 className="text-2xl font-bold">Index not found</h2>
        <Button asChild variant="outline">
          <Link href={`/projects/${slug}/knowledge`}>Back to Knowledge Base</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/projects/${slug}/knowledge`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <PageHeader 
          title={index.name} 
          description={`Manage documents and search in index ${index.external_id || index.id}`} 
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase flex items-center gap-2">
              <Search className="h-4 w-4 text-primary" /> Test Semantic Search
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <input 
                  type="search" 
                  placeholder="Type a natural language query..." 
                  className="w-full bg-background rounded-md border border-input pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <Button size="sm">Search</Button>
            </div>
            <div className="text-xs text-muted-foreground italic border-t pt-4">
              Search results will appear here after query...
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase flex items-center gap-2">
              <Plus className="h-4 w-4 text-green-500" /> Add Document
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <textarea 
              placeholder="Paste document content here..." 
              className="w-full min-h-[100px] bg-background rounded-md border border-input p-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="flex justify-end">
              <Button size="sm" variant="secondary">Ingest Content</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-1">
            <CardTitle>Documents</CardTitle>
            <CardDescription>All indexed documents in this vector store.</CardDescription>
          </div>
          <Badge variant="outline" className="font-mono">{index.id}</Badge>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div>Loading documents...</div>}>
            <DocumentsList indexId={indexId} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
