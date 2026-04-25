"use client";

import { useEffect, useState } from "react";
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent,
  Badge,
  Button
} from "@saas-maker/ui";
import { PageHeader } from "@/components/page-header";
import { KeyRound, Plus, Trash2, ShieldCheck, Globe, Lock } from "lucide-react";
import { apiFetchClient, getClientToken } from "@/lib/api-client";
import { toast } from "sonner";

interface Secret {
  id: string;
  key: string;
  value: string;
  project_id: string | null;
  is_encrypted: boolean;
}

export default function SecretsPage() {
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadSecrets() {
    try {
      const token = await getClientToken();
      const res = await apiFetchClient<{ data: Secret[] }>("/v1/secrets", token);
      setSecrets(res.data || []);
    } catch (err) {
      toast.error("Failed to load secrets");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSecrets();
  }, []);

  async function deleteSecret(id: string) {
    if (!confirm("Are you sure you want to delete this secret?")) return;
    try {
      const token = await getClientToken();
      await apiFetchClient(`/v1/secrets/${id}`, token, { method: "DELETE" });
      toast.success("Secret deleted");
      loadSecrets();
    } catch {
      toast.error("Failed to delete secret");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Secrets Manager"
        description="Manage global and project-specific environment variables for your fleet."
        action={
          <Button variant="default" className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add Secret
          </Button>
        }
      />

      <div className="grid gap-6">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground animate-pulse">Loading secrets...</div>
        ) : secrets.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-12 text-center text-muted-foreground">
               No secrets found. Define global or project-specific variables to sync them across your fleet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {secrets.map((secret) => (
              <Card key={secret.id} className="hover:border-primary/30 transition-colors">
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-md">
                        <KeyRound className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-mono">{secret.key}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          {secret.project_id ? (
                            <Badge variant="outline" className="text-[10px] px-1.5 h-4">Project: {secret.project_id}</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] px-1.5 h-4 flex items-center gap-1">
                              <Globe className="h-2 w-2" /> Global
                            </Badge>
                          )}
                          <Badge variant="success" className="text-[10px] px-1.5 h-4 flex items-center gap-1">
                            <Lock className="h-2 w-2" /> Encrypted
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-muted px-2 py-1 rounded select-all max-w-[200px] truncate">
                        {secret.value.replace(/./g, "•")}
                      </code>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteSecret(secret.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Card className="bg-primary/5 border-primary/20">
        <CardHeader className="p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-sm">Factory Synchronization</CardTitle>
              <CardDescription className="text-xs">
                Run <code className="text-primary font-bold">fnd fleet secrets-sync</code> in your terminal to propagate these variables to every project in your fleet.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}
