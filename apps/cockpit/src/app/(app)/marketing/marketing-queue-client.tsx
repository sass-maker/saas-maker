"use client";

import { Check, Copy, Download, ExternalLink, Megaphone, Plus, Send, Sparkles, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  MarketingPostChannel,
  MarketingPostRow,
  MarketingPostStatus,
} from "@/lib/marketing-queue-store";

const STATUSES: MarketingPostStatus[] = ["generated", "accepted", "rejected", "sent"];
const CHANNELS: MarketingPostChannel[] = ["x", "linkedin", "reddit", "email", "blog", "producthunt", "other"];

const STATUS_LABEL: Record<MarketingPostStatus, string> = {
  generated: "Generated",
  accepted: "Accepted",
  rejected: "Rejected",
  sent: "Sent",
};

const STATUS_CLASS: Record<MarketingPostStatus, string> = {
  generated: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300",
  accepted: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  rejected: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  sent: "border-violet-500/40 bg-violet-500/10 text-violet-300",
};

function postText(post: MarketingPostRow) {
  return [post.hook, post.body, post.cta].filter(Boolean).join("\n\n");
}

function exportMarkdown(posts: MarketingPostRow[]) {
  return posts.map((post) => [
    `## ${post.title}`,
    '',
    `- Project: ${post.project_slug ?? 'Unassigned'}`,
    `- Channel: ${post.channel}`,
    `- Status: ${post.status}`,
    post.source_id ? `- Source: ${post.source_type}:${post.source_id}` : `- Source: ${post.source_type}`,
    '',
    postText(post),
    '',
  ].join('\n')).join('\n---\n');
}

function exportCsv(posts: MarketingPostRow[]) {
  const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const rows = [
    ['project', 'channel', 'status', 'title', 'hook', 'body', 'cta', 'source_type', 'source_id'],
    ...posts.map(post => [
      post.project_slug,
      post.channel,
      post.status,
      post.title,
      post.hook,
      post.body,
      post.cta,
      post.source_type,
      post.source_id,
    ]),
  ];
  return rows.map(row => row.map(escape).join(',')).join('\n');
}

export function MarketingQueueClient({ initialPosts }: { initialPosts: MarketingPostRow[] }) {
  const [posts, setPosts] = useState(initialPosts);
  const [statusFilter, setStatusFilter] = useState<MarketingPostStatus | "all">("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState<MarketingPostChannel | "all">("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    project_slug: "",
    channel: "x" as MarketingPostChannel,
    title: "",
    hook: "",
    body: "",
    cta: "",
  });

  const projectOptions = useMemo(() => Array.from(new Set(posts.map(post => post.project_slug).filter(Boolean))) as string[], [posts]);
  const filteredPosts = posts.filter(post => (
    (statusFilter === "all" || post.status === statusFilter) &&
    (projectFilter === "all" || post.project_slug === projectFilter) &&
    (channelFilter === "all" || post.channel === channelFilter)
  ));
  const generatedCount = posts.filter(post => post.status === "generated").length;
  const acceptedCount = posts.filter(post => post.status === "accepted").length;
  const rejectedCount = posts.filter(post => post.status === "rejected").length;
  const sentCount = posts.filter(post => post.status === "sent").length;

  async function refresh() {
    const res = await fetch("/api/marketing/queue");
    if (!res.ok) throw new Error(await res.text());
    const payload = await res.json() as { data: MarketingPostRow[] };
    setPosts(payload.data);
  }

  async function updatePost(id: string, patch: Partial<MarketingPostRow>) {
    const res = await fetch(`/api/marketing/queue/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      setMessage("Could not update marketing post");
      return;
    }
    const payload = await res.json() as { data: MarketingPostRow };
    setPosts(prev => prev.map(post => post.id === id ? payload.data : post));
  }

  async function createPost() {
    if (!form.title.trim() || !form.body.trim()) {
      setMessage("Title and body are required.");
      return;
    }
    const res = await fetch("/api/marketing/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        project_slug: form.project_slug || null,
        source_type: "manual",
      }),
    });
    if (!res.ok) {
      setMessage("Could not create marketing idea");
      return;
    }
    const payload = await res.json() as { data: MarketingPostRow };
    setPosts(prev => [payload.data, ...prev]);
    setForm({ project_slug: "", channel: "x", title: "", hook: "", body: "", cta: "" });
    setMessage("Idea created.");
  }

  async function deletePost(id: string) {
    const res = await fetch(`/api/marketing/queue/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setMessage("Could not delete marketing post");
      return;
    }
    setPosts(prev => prev.filter(post => post.id !== id));
  }

  async function generateFromChangelog() {
    setMessage("Generating ideas from recent changelog entries…");
    const res = await fetch("/api/marketing/queue/generate-from-changelog", { method: "POST" });
    if (!res.ok) {
      setMessage("Could not generate changelog ideas. Check migration/table state.");
      return;
    }
    const payload = await res.json() as { data: { created: MarketingPostRow[]; skipped: number; scanned: number } };
    await refresh();
    setMessage(`Generated ${payload.data.created.length} ideas from ${payload.data.scanned} changelog entries. Skipped ${payload.data.skipped} duplicates.`);
  }

  async function copyPost(post: MarketingPostRow) {
    await navigator.clipboard.writeText(postText(post));
    setCopiedId(post.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  async function copyExport(format: "markdown" | "csv") {
    const text = format === "markdown" ? exportMarkdown(filteredPosts) : exportCsv(filteredPosts);
    await navigator.clipboard.writeText(text);
    setMessage(`Copied ${filteredPosts.length} ${format.toUpperCase()} rows.`);
  }

  async function markSent() {
    const ids = filteredPosts.filter(post => post.status === "accepted").map(post => post.id);
    await Promise.all(ids.map(id => updatePost(id, {
      status: "sent",
      posted_at: new Date().toISOString(),
    } as Partial<MarketingPostRow>)));
    setMessage(`Marked ${ids.length} accepted posts as sent.`);
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className="rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-200">
          {message}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Card className="gap-1 p-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Total</p>
          <p className="text-3xl font-semibold">{posts.length}</p>
        </Card>
        <Card className="gap-1 p-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Generated</p>
          <p className="text-3xl font-semibold">{generatedCount}</p>
        </Card>
        <Card className="gap-1 p-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Accepted</p>
          <p className="text-3xl font-semibold text-emerald-300">{acceptedCount}</p>
        </Card>
        <Card className="gap-1 p-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Rejected / Sent</p>
          <p className="text-3xl font-semibold"><span className="text-rose-300">{rejectedCount}</span> / <span className="text-violet-300">{sentCount}</span></p>
        </Card>
        <Card className="gap-2 p-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Safe mode</p>
          <p className="text-sm text-muted-foreground">No auto-posting. Accept, reject, then mark sent.</p>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Card className="gap-4 p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={value => setStatusFilter(value as MarketingPostStatus | "all")}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {STATUSES.map(status => <SelectItem key={status} value={status}>{STATUS_LABEL[status]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Project</Label>
                <Select value={projectFilter} onValueChange={setProjectFilter}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All projects</SelectItem>
                    {projectOptions.map(project => <SelectItem key={project} value={project}>{project}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Channel</Label>
                <Select value={channelFilter} onValueChange={value => setChannelFilter(value as MarketingPostChannel | "all")}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {CHANNELS.map(channel => <SelectItem key={channel} value={channel}>{channel}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="ml-auto flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => copyExport("markdown")}><Download className="h-4 w-4" />Copy MD</Button>
                <Button variant="outline" onClick={() => copyExport("csv")}><Download className="h-4 w-4" />Copy CSV</Button>
                <Button onClick={markSent} disabled={acceptedCount === 0}><Send className="h-4 w-4" />Mark sent</Button>
              </div>
            </div>
          </Card>

          <div className="space-y-3">
            {filteredPosts.length === 0 ? (
              <Card className="items-center gap-3 p-10 text-center">
                <Megaphone className="h-8 w-8 text-muted-foreground" />
                <div>
                  <h2 className="font-semibold">No marketing ideas match this filter</h2>
                  <p className="text-sm text-muted-foreground">Generate from changelog, let agents add ideas, or create one manually.</p>
                </div>
              </Card>
            ) : filteredPosts.map(post => (
              <Card key={post.id} className="gap-4 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={STATUS_CLASS[post.status]}>{STATUS_LABEL[post.status]}</Badge>
                      <Badge variant="outline">{post.channel}</Badge>
                      {post.project_slug && <Badge variant="secondary">{post.project_slug}</Badge>}
                      {post.source_id && <span className="font-mono text-xs text-muted-foreground">{post.source_type}:{post.source_id.slice(0, 8)}</span>}
                    </div>
                    <h2 className="truncate text-base font-semibold">{post.title}</h2>
                    {post.hook && <p className="text-sm font-medium text-foreground">{post.hook}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {post.status === "generated" && (
                      <>
                        <Button size="sm" onClick={() => updatePost(post.id, { status: "accepted" })}>
                          <Check className="h-4 w-4" />Accept
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => updatePost(post.id, { status: "rejected" })}>
                          <X className="h-4 w-4" />Reject
                        </Button>
                      </>
                    )}
                    {post.status === "accepted" && (
                      <Button size="sm" onClick={() => updatePost(post.id, { status: "sent", posted_at: new Date().toISOString() } as Partial<MarketingPostRow>)}>
                        <Send className="h-4 w-4" />Sent
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => copyPost(post)}>
                      {copiedId === post.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      Copy
                    </Button>
                    <Select value={post.status} onValueChange={value => updatePost(post.id, { status: value as MarketingPostStatus })}>
                      <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUSES.map(status => <SelectItem key={status} value={status}>{STATUS_LABEL[status]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {post.task_id && (
                      <Button asChild size="icon-sm" variant="ghost">
                        <a href={`/tasks/${post.task_id}`} aria-label="Open task"><ExternalLink className="h-4 w-4" /></a>
                      </Button>
                    )}
                    <Button size="icon-sm" variant="ghost" onClick={() => deletePost(post.id)} aria-label="Delete idea">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 text-sm leading-relaxed text-muted-foreground">
                  {postText(post)}
                </pre>
              </Card>
            ))}
          </div>
        </div>

        <aside className="space-y-4">
          <Card className="gap-4 p-4">
            <div>
              <h2 className="flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4 text-cyan-300" />Generate from changelog</h2>
              <p className="mt-1 text-sm text-muted-foreground">Creates generated X, LinkedIn, and Reddit ideas from recent feature/fix/improvement entries. Duplicates are skipped.</p>
            </div>
            <Button onClick={generateFromChangelog}>Generate ideas</Button>
          </Card>

          <Card className="gap-4 p-4">
            <div>
              <h2 className="flex items-center gap-2 font-semibold"><Plus className="h-4 w-4 text-cyan-300" />Manual idea</h2>
              <p className="mt-1 text-sm text-muted-foreground">Use this for launch ideas that do not come from a changelog entry.</p>
            </div>
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="space-y-1">
                  <Label>Project</Label>
                  <Input value={form.project_slug} onChange={event => setForm(prev => ({ ...prev, project_slug: event.target.value }))} placeholder="linkchat" />
                </div>
                <div className="space-y-1">
                  <Label>Channel</Label>
                  <Select value={form.channel} onValueChange={value => setForm(prev => ({ ...prev, channel: value as MarketingPostChannel }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CHANNELS.map(channel => <SelectItem key={channel} value={channel}>{channel}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Title</Label>
                <Input value={form.title} onChange={event => setForm(prev => ({ ...prev, title: event.target.value }))} placeholder="Launch post for Linkchat" />
              </div>
              <div className="space-y-1">
                <Label>Hook</Label>
                <Input value={form.hook} onChange={event => setForm(prev => ({ ...prev, hook: event.target.value }))} placeholder="Your link-in-bio should answer questions." />
              </div>
              <div className="space-y-1">
                <Label>Body</Label>
                <Textarea value={form.body} onChange={event => setForm(prev => ({ ...prev, body: event.target.value }))} placeholder="Write the post body..." className="min-h-32" />
              </div>
              <div className="space-y-1">
                <Label>CTA</Label>
                <Input value={form.cta} onChange={event => setForm(prev => ({ ...prev, cta: event.target.value }))} placeholder="Try it and send feedback." />
              </div>
              <Button onClick={createPost} className="w-full">Create idea</Button>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
