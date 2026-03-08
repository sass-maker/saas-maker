# Dashboard UI Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix sidebar (project name dropdown + no-scroll), add create dialogs for testimonials, changelog, and knowledge base.

**Architecture:** 4 independent changes: sidebar improvements (client component with project list fetch), 2 new API dashboard endpoints (testimonials + indexes POST with session auth), and 3 create dialog components following existing `create-project-dialog.tsx` pattern.

**Tech Stack:** Next.js 15, Hono API workers, shadcn/ui Dialog/Select components, `apiFetchClient` + `getClientToken` pattern.

---

### Task 1: Fix sidebar scroll + show project name with dropdown switcher

**Files:**
- Modify: `apps/dashboard/src/components/sidebar-nav.tsx`
- Modify: `apps/dashboard/src/app/projects/layout.tsx`

**Step 1: Fix sidebar scroll in layout**

In `layout.tsx`, the sidebar `<aside>` already has `flex flex-col` but the main content area needs to ensure the sidebar stays fixed. Add `h-screen sticky top-0` to the aside:

```tsx
<aside className="hidden md:flex w-64 flex-col border-r bg-background h-screen sticky top-0">
```

**Step 2: Update SidebarNav to fetch projects and show dropdown**

Replace the static "PROJECT" label with a dropdown showing the current project name and all projects for switching. Fetch projects list from `/api/token` + `/v1/projects` on mount.

```tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Brain,
  ChevronDown,
  ClipboardList,
  FolderOpen,
  Megaphone,
  MessageSquare,
  Settings,
  Star,
  Users,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { apiFetchClient, getClientToken } from "@/lib/api-client";

interface Project {
  id: string;
  name: string;
  slug: string;
}

const projectNavItems = [
  { label: "Feedback", href: "", icon: MessageSquare },
  { label: "Testimonials", href: "/testimonials", icon: Star },
  { label: "Waitlist", href: "/waitlist", icon: Users },
  { label: "Changelog", href: "/changelog", icon: Megaphone },
  { label: "Knowledge Base", href: "/indexes", icon: Brain },
  { label: "Forms", href: "/forms", icon: ClipboardList },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();
  const slugMatch = pathname.match(/\/projects\/([^/]+)/);
  const slug = slugMatch?.[1];

  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);

  useEffect(() => {
    async function loadProjects() {
      try {
        const token = await getClientToken();
        const res = await apiFetchClient<{ data: Project[] }>(
          "/v1/projects",
          token
        );
        setProjects(res.data ?? []);
      } catch {
        // Silently fail — sidebar still works
      }
    }
    loadProjects();
  }, []);

  useEffect(() => {
    if (slug && projects.length > 0) {
      const found = projects.find((p) => p.slug === slug);
      if (found) setCurrentProject(found);
    } else {
      setCurrentProject(null);
    }
  }, [slug, projects]);

  return (
    <nav className="flex flex-col gap-1">
      <Link
        href="/projects"
        className={cn(
          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
          pathname === "/projects"
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        )}
      >
        <FolderOpen className="h-4 w-4" />
        Projects
      </Link>

      {slug && currentProject && (
        <ul className="mt-3 flex flex-col gap-1">
          <li className="mb-1 px-1">
            <DropdownMenu>
              <DropdownMenuTrigger className="flex w-full items-center justify-between rounded-md px-1 py-1 text-xs font-medium text-muted-foreground/70 uppercase tracking-wider hover:text-foreground transition-colors">
                <span className="truncate">{currentProject.name}</span>
                <ChevronDown className="h-3 w-3 shrink-0" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                {projects.map((p) => (
                  <DropdownMenuItem
                    key={p.id}
                    onClick={() => router.push(`/projects/${p.slug}`)}
                    className={cn(
                      p.slug === slug && "bg-muted font-medium"
                    )}
                  >
                    {p.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
          {projectNavItems.map((item) => {
            const href = `/projects/${slug}${item.href}`;
            const isActive =
              item.href === ""
                ? pathname === `/projects/${slug}`
                : pathname.startsWith(href);

            return (
              <li key={item.label}>
                <Link
                  href={href}
                  prefetch={false}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                    isActive
                      ? "bg-muted text-foreground font-medium"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {!slug && (
        <p className="mt-4 px-2 text-xs text-muted-foreground">
          Select a project to see navigation
        </p>
      )}
    </nav>
  );
}
```

**Step 3: Commit**

```bash
git add apps/dashboard/src/components/sidebar-nav.tsx apps/dashboard/src/app/projects/layout.tsx
git commit -m "feat: show project name in sidebar with dropdown switcher + fix scroll"
```

---

### Task 2: Add dashboard testimonial creation endpoint

**Files:**
- Modify: `workers/api/src/routes/testimonials.ts`

**Step 1: Add POST /dashboard/:projectId route**

Add this route after the existing `GET /all` route (before the PATCH route, around line 106). Uses `requireSession` — the project owner can create testimonials directly.

```ts
// Dashboard: create testimonial (session auth — project owner)
testimonials.post('/dashboard/:projectId', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');

  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const body = (await c.req.json()) as SubmitTestimonialRequest;

  if (!body.author_name?.trim()) return c.json({ error: 'Name is required' }, 400);
  if (!body.author_email?.trim()) return c.json({ error: 'Email is required' }, 400);
  if (!body.content?.trim()) return c.json({ error: 'Content is required' }, 400);
  if (!body.rating || body.rating < 1 || body.rating > 5) return c.json({ error: 'Rating must be 1-5' }, 400);

  const entry = await db.createTestimonial({
    id: crypto.randomUUID(),
    project_id: projectId,
    author_name: body.author_name.trim(),
    author_email: body.author_email.trim().toLowerCase(),
    author_avatar_url: body.author_avatar_url?.trim() || null,
    author_title: body.author_title?.trim() || null,
    content: body.content.trim(),
    rating: body.rating,
    image_url: body.image_url || null,
    tweet_url: body.tweet_url?.trim() || null,
  });

  return c.json(entry, 201);
});
```

**Step 2: Commit**

```bash
git add workers/api/src/routes/testimonials.ts
git commit -m "feat: add dashboard testimonial creation endpoint (session auth)"
```

---

### Task 3: Add dashboard index creation endpoint

**Files:**
- Modify: `workers/api/src/routes/indexes.ts`

**Step 1: Add POST /dashboard/:projectId route**

Add after the existing `GET /dashboard/:projectId/:indexId/documents` route (before the `indexes.use('*', requireApiKey)` line ~80). Note: embedding model is disabled in the UI for now (defaults to project's existing model), but the endpoint accepts it for future use.

```ts
// Dashboard: create index (session auth — project owner)
indexes.post('/dashboard/:projectId', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');

  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const body = (await c.req.json()) as CreateIndexRequest;

  if (!body.name?.trim()) return c.json({ error: 'Index name is required' }, 400);

  // If project has no embedding model yet, require one
  if (!project.embedding_model && !body.embedding_model) {
    return c.json({ error: 'Project has no embedding model. Provide embedding_model.' }, 400);
  }

  if (body.embedding_model) {
    // Validate model — reuse SUPPORTED_MODELS from above
    const SUPPORTED = ['voyage-4-large', 'voyage-4', 'voyage-4-lite', 'voyage-code-3',
      'voyage-finance-2', 'voyage-law-2', 'gemini-embedding-001',
      '@cf/baai/bge-base-en-v1.5', '@cf/baai/bge-large-en-v1.5', '@cf/baai/bge-m3'];
    if (!SUPPORTED.includes(body.embedding_model)) {
      return c.json({ error: `Unsupported model: ${body.embedding_model}` }, 400);
    }
    // Lock model on first use
    if (!project.embedding_model) {
      await db.updateProject(projectId, { embedding_model: body.embedding_model });
    }
  }

  try {
    const record = await db.createIndex({
      id: crypto.randomUUID(),
      project_id: projectId,
      name: body.name.trim(),
      external_id: body.external_id?.trim() || null,
    });
    return c.json(record, 201);
  } catch (e: any) {
    if (e.message?.includes('duplicate') || e.code === '23505') {
      return c.json({ error: 'Index name already exists in this project' }, 409);
    }
    throw e;
  }
});
```

**Step 2: Commit**

```bash
git add workers/api/src/routes/indexes.ts
git commit -m "feat: add dashboard index creation endpoint (session auth)"
```

---

### Task 4: Add "Add Testimonial" dialog to testimonials page

**Files:**
- Create: `apps/dashboard/src/app/projects/[slug]/testimonials/create-testimonial-dialog.tsx`
- Modify: `apps/dashboard/src/app/projects/[slug]/testimonials/page.tsx`

**Step 1: Create the dialog component**

Follow existing `create-project-dialog.tsx` pattern. Fields: author_name, author_email, author_title (optional), content (textarea), rating (1-5 select), tweet_url (optional).

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { apiFetchClient, getClientToken } from "@/lib/api-client";

interface Props {
  projectId: string;
}

export function CreateTestimonialDialog({ projectId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [authorName, setAuthorName] = useState("");
  const [authorEmail, setAuthorEmail] = useState("");
  const [authorTitle, setAuthorTitle] = useState("");
  const [content, setContent] = useState("");
  const [rating, setRating] = useState("5");
  const [tweetUrl, setTweetUrl] = useState("");

  function resetForm() {
    setAuthorName("");
    setAuthorEmail("");
    setAuthorTitle("");
    setContent("");
    setRating("5");
    setTweetUrl("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const token = await getClientToken();
      await apiFetchClient(
        `/v1/testimonials/dashboard/${projectId}`,
        token,
        {
          method: "POST",
          body: JSON.stringify({
            author_name: authorName.trim(),
            author_email: authorEmail.trim(),
            author_title: authorTitle.trim() || undefined,
            content: content.trim(),
            rating: parseInt(rating, 10),
            tweet_url: tweetUrl.trim() || undefined,
          }),
        }
      );
      setOpen(false);
      resetForm();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add testimonial");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Testimonial
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Testimonial</DialogTitle>
            <DialogDescription>
              Manually add a testimonial from a customer.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="author-name">Name *</Label>
                <Input id="author-name" value={authorName} onChange={(e) => setAuthorName(e.target.value)} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="author-email">Email *</Label>
                <Input id="author-email" type="email" value={authorEmail} onChange={(e) => setAuthorEmail(e.target.value)} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="author-title">Title</Label>
                <Input id="author-title" placeholder="CEO at Acme" value={authorTitle} onChange={(e) => setAuthorTitle(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="rating">Rating *</Label>
                <Select value={rating} onValueChange={setRating}>
                  <SelectTrigger id="rating"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[5, 4, 3, 2, 1].map((n) => (
                      <SelectItem key={n} value={String(n)}>{"★".repeat(n)}{"☆".repeat(5 - n)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="content">Content *</Label>
              <Textarea id="content" rows={3} value={content} onChange={(e) => setContent(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tweet-url">Tweet URL</Label>
              <Input id="tweet-url" type="url" placeholder="https://twitter.com/..." value={tweetUrl} onChange={(e) => setTweetUrl(e.target.value)} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !authorName.trim() || !authorEmail.trim() || !content.trim()}>
              {loading ? "Adding..." : "Add Testimonial"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Wire into testimonials page**

In `page.tsx`, import `CreateTestimonialDialog` and pass it as the `action` prop to `PageHeader`:

```tsx
import { CreateTestimonialDialog } from "./create-testimonial-dialog";
// ...
<PageHeader
  title="Testimonials"
  description={`${total} total testimonial${total !== 1 ? "s" : ""}`}
  action={<CreateTestimonialDialog projectId={project.id} />}
/>
```

**Step 3: Commit**

```bash
git add apps/dashboard/src/app/projects/\[slug\]/testimonials/
git commit -m "feat: add create testimonial dialog to dashboard"
```

---

### Task 5: Add "New Entry" dialog to changelog page

**Files:**
- Create: `apps/dashboard/src/app/projects/[slug]/changelog/create-changelog-dialog.tsx`
- Modify: `apps/dashboard/src/app/projects/[slug]/changelog/page.tsx`

**Step 1: Create the dialog component**

Fields: title, content (textarea), version (optional), type (select: feature/improvement/fix/breaking), published (checkbox-like toggle).

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus } from "lucide-react";
import { apiFetchClient, getClientToken } from "@/lib/api-client";

interface Props {
  projectId: string;
}

export function CreateChangelogDialog({ projectId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [version, setVersion] = useState("");
  const [type, setType] = useState("improvement");
  const [published, setPublished] = useState(false);

  function resetForm() {
    setTitle("");
    setContent("");
    setVersion("");
    setType("improvement");
    setPublished(false);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const token = await getClientToken();
      await apiFetchClient(
        `/v1/changelog/dashboard/${projectId}`,
        token,
        {
          method: "POST",
          body: JSON.stringify({
            title: title.trim(),
            content: content.trim(),
            version: version.trim() || undefined,
            type,
            published,
          }),
        }
      );
      setOpen(false);
      resetForm();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create entry");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Entry
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New Changelog Entry</DialogTitle>
            <DialogDescription>
              Create a changelog entry to keep users informed.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="cl-title">Title *</Label>
              <Input id="cl-title" placeholder="New feature: ..." value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cl-content">Content *</Label>
              <Textarea id="cl-content" rows={4} value={content} onChange={(e) => setContent(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="cl-version">Version</Label>
                <Input id="cl-version" placeholder="1.2.0" value={version} onChange={(e) => setVersion(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cl-type">Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger id="cl-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="feature">Feature</SelectItem>
                    <SelectItem value="improvement">Improvement</SelectItem>
                    <SelectItem value="fix">Fix</SelectItem>
                    <SelectItem value="breaking">Breaking</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="cl-published" checked={published} onCheckedChange={setPublished} />
              <Label htmlFor="cl-published">Publish immediately</Label>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !title.trim() || !content.trim()}>
              {loading ? "Creating..." : published ? "Publish" : "Save Draft"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Wire into changelog page**

```tsx
import { CreateChangelogDialog } from "./create-changelog-dialog";
// ...
<PageHeader
  title="Changelog"
  description={`${total} total entr${total !== 1 ? "ies" : "y"}`}
  action={<CreateChangelogDialog projectId={project.id} />}
/>
```

**Step 3: Commit**

```bash
git add apps/dashboard/src/app/projects/\[slug\]/changelog/
git commit -m "feat: add create changelog entry dialog to dashboard"
```

---

### Task 6: Add "Create Index" dialog to knowledge base page

**Files:**
- Create: `apps/dashboard/src/app/projects/[slug]/indexes/create-index-dialog.tsx`
- Modify: `apps/dashboard/src/app/projects/[slug]/indexes/page.tsx`

**Step 1: Create the dialog component**

Fields: name, external_id (optional). Embedding model selector is disabled — shows the project's current model with a note that changing it requires rebuilding all indexes.

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { apiFetchClient, getClientToken } from "@/lib/api-client";

interface Props {
  projectId: string;
  embeddingModel: string | null;
}

export function CreateIndexDialog({ projectId, embeddingModel }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [externalId, setExternalId] = useState("");

  function resetForm() {
    setName("");
    setExternalId("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const token = await getClientToken();
      await apiFetchClient(
        `/v1/indexes/dashboard/${projectId}`,
        token,
        {
          method: "POST",
          body: JSON.stringify({
            name: name.trim(),
            external_id: externalId.trim() || undefined,
            // Use project's existing model; if none set, use a sensible default
            ...(!embeddingModel ? { embedding_model: "@cf/baai/bge-base-en-v1.5" } : {}),
          }),
        }
      );
      setOpen(false);
      resetForm();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create index");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Index
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Index</DialogTitle>
            <DialogDescription>
              Create a new vector index for your knowledge base.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="idx-name">Index Name *</Label>
              <Input id="idx-name" placeholder="docs, faq, support..." value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="idx-external">External ID</Label>
              <Input id="idx-external" placeholder="Optional identifier" value={externalId} onChange={(e) => setExternalId(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Embedding Model</Label>
              <Input
                value={embeddingModel ?? "@cf/baai/bge-base-en-v1.5 (default)"}
                disabled
                className="text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground">
                {embeddingModel
                  ? "Locked for this project. Changing requires rebuilding all indexes."
                  : "Will be set to the default on first index creation."}
              </p>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? "Creating..." : "Create Index"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Wire into indexes page**

```tsx
import { CreateIndexDialog } from "./create-index-dialog";
// ...
<PageHeader
  title="Indexes"
  description={`${indexes.length} total index${indexes.length !== 1 ? "es" : ""}`}
  action={<CreateIndexDialog projectId={project.id} embeddingModel={project.embedding_model} />}
/>
```

**Step 3: Commit**

```bash
git add apps/dashboard/src/app/projects/\[slug\]/indexes/
git commit -m "feat: add create index dialog to knowledge base page"
```
