"use client";

import { useEffect, useState } from "react";
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent,
  Button
} from "@saas-maker/ui";
import { PageHeader } from "@/components/page-header";
import { FileJson, Save, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

export default function ManifestPage() {
  const [manifest, setManifest] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadManifest() {
    setLoading(true);
    try {
      const res = await fetch("/api/fleet/scan");
      const data = await res.json();
      setManifest(data.manifest || {});
    } catch (err) {
      toast.error("Failed to load manifest");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadManifest();
  }, []);

  async function saveManifest() {
    setSaving(true);
    try {
      const res = await fetch("/api/fleet/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manifest }),
      });
      if (!res.ok) throw new Error();
      toast.success("Manifest saved to foundry.projects.json");
    } catch {
      toast.error("Failed to save manifest");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Project Manifest"
        description="Edit the mission statements for your fleet units. These appear in 'fnd fleet list'."
        action={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={loadManifest} disabled={loading}>
              <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button onClick={saveManifest} disabled={saving} className="flex items-center gap-2">
              <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        }
      />

      <div className="grid gap-4">
        {loading ? (
          <div className="p-8 text-center animate-pulse">Loading manifest...</div>
        ) : (
          Object.keys(manifest).sort().map((slug) => (
            <Card key={slug}>
              <CardHeader className="p-4 flex flex-row items-center gap-4 space-y-0">
                <div className="w-1/4">
                  <CardTitle className="text-sm font-mono text-primary">{slug}</CardTitle>
                </div>
                <div className="flex-1">
                  <input 
                    className="w-full bg-transparent border-none text-sm focus:ring-0 focus:outline-none placeholder:italic"
                    placeholder="Enter one-sentence mission statement..."
                    value={manifest[slug]}
                    onChange={(e) => setManifest({ ...manifest, [slug]: e.target.value })}
                  />
                </div>
              </CardHeader>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
