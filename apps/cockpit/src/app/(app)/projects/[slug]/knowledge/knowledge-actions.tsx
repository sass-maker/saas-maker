"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@saas-maker/ui";
import { Loader2, Search, Trash2 } from "lucide-react";
import { apiFetchClient, getClientToken } from "@/lib/api-client";

type SearchResult = {
  document_id: string;
  chunk_content: string;
  score: number;
  metadata?: Record<string, unknown>;
};

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : "Request failed";
}

export function CreateIndexForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [externalId, setExternalId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const token = await getClientToken();
      await apiFetchClient("/v1/knowledge/indexes", token, {
        method: "POST",
        body: JSON.stringify({
          project_id: projectId,
          name,
          ...(externalId.trim() ? { external_id: externalId.trim() } : {}),
        }),
      });
      setName("");
      setExternalId("");
      router.refresh();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 rounded-md border bg-muted/20 p-4 md:grid-cols-[1fr_1fr_auto]">
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Index name"
        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        required
      />
      <input
        value={externalId}
        onChange={(event) => setExternalId(event.target.value)}
        placeholder="External ID"
        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
      />
      <Button type="submit" size="sm" disabled={saving || !name.trim()}>
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        New Index
      </Button>
      {error ? <p className="text-sm text-destructive md:col-span-3">{error}</p> : null}
    </form>
  );
}

export function AddDocumentForm({ indexId }: { indexId: string }) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [metadata, setMetadata] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const token = await getClientToken();
      const parsedMetadata = metadata.trim() ? JSON.parse(metadata) : {};
      await apiFetchClient(`/v1/knowledge/indexes/${indexId}/documents`, token, {
        method: "POST",
        body: JSON.stringify({ content, metadata: parsedMetadata }),
      });
      setContent("");
      setMetadata("");
      router.refresh();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder="Paste document content here..."
        className="min-h-[110px] w-full rounded-md border border-input bg-background p-3 text-sm"
        required
      />
      <input
        value={metadata}
        onChange={(event) => setMetadata(event.target.value)}
        placeholder='Metadata JSON, e.g. {"source":"docs"}'
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
      />
      <div className="flex justify-end">
        <Button type="submit" size="sm" variant="secondary" disabled={saving || !content.trim()}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Ingest Content
        </Button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </form>
  );
}

export function KnowledgeSearchPanel({ indexId }: { indexId: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearching(true);
    setError(null);
    try {
      const token = await getClientToken();
      const payload = await apiFetchClient<{ data: SearchResult[] }>(
        `/v1/knowledge/indexes/${indexId}/search`,
        token,
        { method: "POST", body: JSON.stringify({ query, top_k: 5 }) },
      );
      setResults(payload.data);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            type="search"
            placeholder="Type a natural language query..."
            className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm"
            required
          />
        </div>
        <Button type="submit" size="sm" disabled={searching || !query.trim()}>
          {searching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Search
        </Button>
      </form>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {results.length > 0 ? (
        <div className="space-y-2 border-t pt-3">
          {results.map((result) => (
            <div key={`${result.document_id}-${result.score}`} className="rounded-md border bg-muted/20 p-3">
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-mono">{result.document_id}</span>
                <span>{Math.round(result.score * 100)}%</span>
              </div>
              <p className="text-sm">{result.chunk_content}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function DeleteDocumentButton({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this indexed document?")) return;
    setDeleting(true);
    try {
      const token = await getClientToken();
      await apiFetchClient(`/v1/knowledge/documents/${documentId}`, token, { method: "DELETE" });
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
      onClick={handleDelete}
      disabled={deleting}
    >
      {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </Button>
  );
}
