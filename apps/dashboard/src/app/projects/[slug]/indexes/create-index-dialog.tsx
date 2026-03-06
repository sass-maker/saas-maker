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
            ...(!embeddingModel
              ? { embedding_model: "@cf/baai/bge-base-en-v1.5" }
              : {}),
          }),
        }
      );
      setOpen(false);
      resetForm();
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create index"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetForm();
      }}
    >
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
              <Input
                id="idx-name"
                placeholder="docs, faq, support..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="idx-external">External ID</Label>
              <Input
                id="idx-external"
                placeholder="Optional identifier"
                value={externalId}
                onChange={(e) => setExternalId(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Embedding Model</Label>
              <Input
                value={
                  embeddingModel ?? "@cf/baai/bge-base-en-v1.5 (default)"
                }
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
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? "Creating..." : "Create Index"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
