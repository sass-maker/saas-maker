import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent,
  Button,
  Badge
} from "@saas-maker/ui";
import { Brain, Plus, Search, Database, FileText, Trash2 } from "lucide-react";
import { getAuthenticatedProject } from "../get-project";
import { apiFetchAuthed } from "@/lib/api-client";
import Link from "next/link";

interface IndexRow {
  id: string;
  name: string;
  external_id: string | null;
  document_count: number;
  created_at: string;
}

async function IndexesList({ projectId, slug }: { projectId: string; slug: string }) {
  const { data: indexes } = await apiFetchAuthed<{ data: IndexRow[] }>(
    `/v1/knowledge/indexes?project_id=${projectId}`
  );

  if (indexes.length === 0) {
    return (
      <Card className="border-dashed py-12">
        <CardContent className="flex flex-col items-center justify-center text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <Brain className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-lg">No Knowledge Indexes</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Create your first knowledge index to enable semantic search and RAG capabilities.
            </p>
          </div>
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" /> Create Index
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {indexes.map((index) => (
        <Card key={index.id} className="hover:border-primary/50 transition-colors">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="text-base">{index.name}</CardTitle>
                <CardDescription className="text-xs font-mono">
                  {index.external_id || index.id}
                </CardDescription>
              </div>
              <Database className="h-4 w-4 text-muted-foreground/50" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <FileText className="h-3.5 w-3.5" />
                {index.document_count} documents
              </div>
              <Button variant="ghost" size="sm" className="h-8 px-2" asChild>
                <Link href={`/projects/${slug}/knowledge/${index.id}`}>
                  Manage <Plus className="h-3 w-3 ml-1" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default async function KnowledgeBasePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { project } = await getAuthenticatedProject(slug);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader 
          title="Knowledge Base" 
          description="Vector-based semantic search and RAG indexes." 
        />
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> New Index
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary/70">Total Indexes</p>
              <div className="text-2xl font-bold">...</div>
            </div>
            <Brain className="h-5 w-5 text-primary/40" />
          </CardHeader>
        </Card>
        <Card className="bg-muted/50 border-muted">
          <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Semantic Queries</p>
              <div className="text-2xl font-bold">...</div>
            </div>
            <Search className="h-5 w-5 text-muted-foreground/40" />
          </CardHeader>
        </Card>
        <Card className="bg-muted/50 border-muted">
          <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Active Storage</p>
              <div className="text-2xl font-bold">Cloudflare D1</div>
            </div>
            <Database className="h-5 w-5 text-muted-foreground/40" />
          </CardHeader>
        </Card>
      </div>

      <Suspense fallback={<div>Loading indexes...</div>}>
        <IndexesList projectId={project.id} slug={slug} />
      </Suspense>
    </div>
  );
}
