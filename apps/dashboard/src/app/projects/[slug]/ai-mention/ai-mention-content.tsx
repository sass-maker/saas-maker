"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Eye,
  Plus,
  Trash2,
  Play,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  Key,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { apiFetchClient, getClientToken } from "@/lib/api-client";
import type {
  AIMentionConfigRecord,
  AIMentionPromptRecord,
  AIMentionCheckRecord,
  AIMentionResultRecord,
  AIMentionCheckDashboard,
} from "@saas-maker/shared-types";

interface Props {
  projectId: string;
}

export function AIMentionContent({ projectId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<AIMentionConfigRecord | null>(null);
  const [prompts, setPrompts] = useState<AIMentionPromptRecord[]>([]);
  const [checks, setChecks] = useState<AIMentionCheckRecord[]>([]);
  const [latestResults, setLatestResults] = useState<AIMentionResultRecord[]>([]);
  const [expandedResult, setExpandedResult] = useState<string | null>(null);

  // Config form state
  const [brandName, setBrandName] = useState("");
  const [brandAliases, setBrandAliases] = useState("");
  const [brandUrl, setBrandUrl] = useState("");
  const [competitors, setCompetitors] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [googleKey, setGoogleKey] = useState("");
  const [perplexityKey, setPerplexityKey] = useState("");
  const [saving, setSaving] = useState(false);

  // Prompt form
  const [newPrompt, setNewPrompt] = useState("");
  const [promptCategory, setPromptCategory] = useState("");
  const [addingPrompt, setAddingPrompt] = useState(false);

  // Check state
  const [runningCheck, setRunningCheck] = useState(false);
  const [pollingCheck, setPollingCheck] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      const token = await getClientToken();
      const data = await apiFetchClient<AIMentionCheckDashboard>(
        `/v1/ai-mention/dashboard/${projectId}`,
        token
      );
      setConfig(data.config);
      setPrompts(data.prompts);
      setChecks(data.recent_checks);
      setLatestResults(data.latest_results);

      if (data.config) {
        setBrandName(data.config.brand_name);
        setBrandAliases(data.config.brand_aliases.join(", "));
        setBrandUrl(data.config.brand_url || "");
        setCompetitors(data.config.competitors.map((c) => c.name).join(", "));
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Poll for running check
  useEffect(() => {
    if (!pollingCheck) return;
    const interval = setInterval(async () => {
      try {
        const token = await getClientToken();
        const check = await apiFetchClient<AIMentionCheckRecord & { results: AIMentionResultRecord[] }>(
          `/v1/ai-mention/checks/${projectId}/${pollingCheck}`,
          token
        );
        if (check.status !== "running") {
          setPollingCheck(null);
          setRunningCheck(false);
          loadDashboard();
        }
      } catch {
        setPollingCheck(null);
        setRunningCheck(false);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [pollingCheck, projectId, loadDashboard]);

  const saveConfig = async () => {
    setSaving(true);
    try {
      const token = await getClientToken();
      const payload: any = {
        brand_name: brandName,
        brand_aliases: brandAliases.split(",").map((s) => s.trim()).filter(Boolean),
        brand_url: brandUrl || undefined,
        competitors: competitors.split(",").map((s) => s.trim()).filter(Boolean).map((name) => ({ name })),
      };
      if (openaiKey) payload.openai_api_key = openaiKey;
      if (anthropicKey) payload.anthropic_api_key = anthropicKey;
      if (googleKey) payload.google_api_key = googleKey;
      if (perplexityKey) payload.perplexity_api_key = perplexityKey;

      const updated = await apiFetchClient<AIMentionConfigRecord>(
        `/v1/ai-mention/config/${projectId}`,
        token,
        { method: "POST", body: JSON.stringify(payload) }
      );
      setConfig(updated);
      setOpenaiKey("");
      setAnthropicKey("");
      setGoogleKey("");
      setPerplexityKey("");
    } catch {
      // Error silently
    } finally {
      setSaving(false);
    }
  };

  const addPrompt = async () => {
    if (!newPrompt.trim()) return;
    setAddingPrompt(true);
    try {
      const token = await getClientToken();
      const prompt = await apiFetchClient<AIMentionPromptRecord>(
        `/v1/ai-mention/prompts/${projectId}`,
        token,
        { method: "POST", body: JSON.stringify({ prompt_text: newPrompt, category: promptCategory || undefined }) }
      );
      setPrompts((prev) => [...prev, prompt]);
      setNewPrompt("");
      setPromptCategory("");
    } catch {
      // Error silently
    } finally {
      setAddingPrompt(false);
    }
  };

  const deletePrompt = async (id: string) => {
    try {
      const token = await getClientToken();
      await apiFetchClient(`/v1/ai-mention/prompts/${projectId}/${id}`, token, { method: "DELETE" });
      setPrompts((prev) => prev.filter((p) => p.id !== id));
    } catch {
      // Error silently
    }
  };

  const runCheck = async () => {
    setRunningCheck(true);
    try {
      const token = await getClientToken();
      const check = await apiFetchClient<AIMentionCheckRecord>(
        `/v1/ai-mention/check/${projectId}`,
        token,
        { method: "POST" }
      );
      setPollingCheck(check.id);
      setChecks((prev) => [check, ...prev]);
    } catch {
      setRunningCheck(false);
    }
  };

  const viewCheck = async (checkId: string) => {
    try {
      const token = await getClientToken();
      const check = await apiFetchClient<AIMentionCheckRecord & { results: AIMentionResultRecord[] }>(
        `/v1/ai-mention/checks/${projectId}/${checkId}`,
        token
      );
      setLatestResults(check.results);
    } catch {
      // Error silently
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Setup Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Configuration
          </CardTitle>
          <CardDescription>
            Configure your brand details and API keys to check AI visibility.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="brand-name">Brand Name *</Label>
              <Input
                id="brand-name"
                placeholder="Your Product Name"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand-url">Brand URL</Label>
              <Input
                id="brand-url"
                placeholder="https://yourproduct.com"
                value={brandUrl}
                onChange={(e) => setBrandUrl(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="brand-aliases">Brand Aliases (comma-separated)</Label>
              <Input
                id="brand-aliases"
                placeholder="Alias 1, Alias 2"
                value={brandAliases}
                onChange={(e) => setBrandAliases(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="competitors">Competitors (comma-separated, max 5)</Label>
              <Input
                id="competitors"
                placeholder="Competitor A, Competitor B"
                value={competitors}
                onChange={(e) => setCompetitors(e.target.value)}
              />
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Key className="h-4 w-4" />
              API Keys (BYOK — your keys, your cost)
            </h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="openai-key">
                  OpenAI API Key
                  {config?.has_openai_key && <Badge variant="secondary" className="ml-2 text-xs">saved</Badge>}
                </Label>
                <Input
                  id="openai-key"
                  type="password"
                  placeholder={config?.has_openai_key ? "••••••••" : "sk-..."}
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="anthropic-key">
                  Anthropic API Key
                  {config?.has_anthropic_key && <Badge variant="secondary" className="ml-2 text-xs">saved</Badge>}
                </Label>
                <Input
                  id="anthropic-key"
                  type="password"
                  placeholder={config?.has_anthropic_key ? "••••••••" : "sk-ant-..."}
                  value={anthropicKey}
                  onChange={(e) => setAnthropicKey(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="google-key">
                  Google AI API Key
                  {config?.has_google_key && <Badge variant="secondary" className="ml-2 text-xs">saved</Badge>}
                </Label>
                <Input
                  id="google-key"
                  type="password"
                  placeholder={config?.has_google_key ? "••••••••" : "AI..."}
                  value={googleKey}
                  onChange={(e) => setGoogleKey(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="perplexity-key">
                  Perplexity API Key
                  {config?.has_perplexity_key && <Badge variant="secondary" className="ml-2 text-xs">saved</Badge>}
                </Label>
                <Input
                  id="perplexity-key"
                  type="password"
                  placeholder={config?.has_perplexity_key ? "••••••••" : "pplx-..."}
                  value={perplexityKey}
                  onChange={(e) => setPerplexityKey(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={saveConfig} disabled={saving || !brandName.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Configuration
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Prompts Card */}
      <Card>
        <CardHeader>
          <CardTitle>Prompts</CardTitle>
          <CardDescription>
            Add prompts that users might ask AI assistants about your product category. Max 20.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {prompts.length > 0 && (
            <div className="space-y-2">
              {prompts.map((prompt) => (
                <div
                  key={prompt.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <div className="flex-1">
                    <span>{prompt.prompt_text}</span>
                    {prompt.category && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        {prompt.category}
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deletePrompt(prompt.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {prompts.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No prompts yet. Add prompts like &quot;What&apos;s the best feedback tool for SaaS?&quot;
            </p>
          )}

          <div className="flex gap-2">
            <Input
              placeholder="What's the best [category] tool?"
              value={newPrompt}
              onChange={(e) => setNewPrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addPrompt()}
              className="flex-1"
            />
            <Input
              placeholder="Category"
              value={promptCategory}
              onChange={(e) => setPromptCategory(e.target.value)}
              className="w-32"
            />
            <Button onClick={addPrompt} disabled={addingPrompt || !newPrompt.trim()} size="sm">
              {addingPrompt ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Run Check */}
      <div className="flex justify-center">
        <Button
          size="lg"
          onClick={runCheck}
          disabled={runningCheck || !config || prompts.length === 0}
          className="px-8"
        >
          {runningCheck ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Running Check...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Run AI Mention Check
            </>
          )}
        </Button>
      </div>

      {/* Results */}
      {latestResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Results</span>
              {checks.length > 0 && checks[0].brand_mention_rate !== null && (
                <Badge variant={checks[0].brand_mention_rate > 0.5 ? "default" : "secondary"}>
                  {Math.round(checks[0].brand_mention_rate * 100)}% mention rate
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {latestResults.map((result) => {
                const isExpanded = expandedResult === result.id;
                return (
                  <div key={result.id} className="rounded-md border">
                    <button
                      className="flex w-full items-center justify-between px-4 py-3 text-sm text-left hover:bg-muted/50 transition-colors"
                      onClick={() => setExpandedResult(isExpanded ? null : result.id)}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {result.brand_mentioned ? (
                          <Check className="h-4 w-4 text-green-500 shrink-0" />
                        ) : (
                          <X className="h-4 w-4 text-red-500 shrink-0" />
                        )}
                        <Badge variant="outline" className="shrink-0">
                          {result.platform}
                        </Badge>
                        <span className="truncate text-muted-foreground">
                          {prompts.find((p) => p.id === result.prompt_id)?.prompt_text || result.prompt_id}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {result.brand_position && (
                          <Badge variant="secondary">#{result.brand_position}</Badge>
                        )}
                        {result.brand_sentiment && (
                          <Badge
                            variant={
                              result.brand_sentiment === "positive"
                                ? "default"
                                : result.brand_sentiment === "negative"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {result.brand_sentiment}
                          </Badge>
                        )}
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="border-t px-4 py-3 space-y-3">
                        <div className="text-sm whitespace-pre-wrap bg-muted/50 rounded-md p-3 max-h-64 overflow-y-auto">
                          {result.response_text}
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className="text-muted-foreground">Model: {result.model}</span>
                          {result.latency_ms && (
                            <span className="text-muted-foreground">
                              Latency: {result.latency_ms}ms
                            </span>
                          )}
                          {result.brand_cited && (
                            <Badge variant="outline" className="text-xs">Cited</Badge>
                          )}
                          {result.competitors_mentioned.filter((c) => c.mentioned).length > 0 && (
                            <span className="text-muted-foreground">
                              Competitors: {result.competitors_mentioned.filter((c) => c.mentioned).map((c) => c.name).join(", ")}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* MentionPilot Upsell */}
      <Card className="border-primary/50 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold">Want more AI visibility insights?</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Track trends over time, optimize content for AI citation, monitor Reddit &amp; HN mentions,
                and deploy an AXP shadow site — all on MentionPilot.
              </p>
            </div>
            <a
              href="https://mentionpilot-web.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" className="shrink-0">
                Open MentionPilot
                <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>

      {/* History */}
      {checks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Check History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {checks.map((check) => (
                <button
                  key={check.id}
                  className="flex w-full items-center justify-between rounded-md border px-4 py-3 text-sm hover:bg-muted/50 transition-colors text-left"
                  onClick={() => viewCheck(check.id)}
                >
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={
                        check.status === "completed"
                          ? "default"
                          : check.status === "running"
                          ? "secondary"
                          : "destructive"
                      }
                    >
                      {check.status}
                    </Badge>
                    <span className="text-muted-foreground">
                      {new Date(check.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {check.brand_mention_rate !== null && (
                      <span className="font-medium">
                        {Math.round(check.brand_mention_rate * 100)}%
                      </span>
                    )}
                    <span className="text-muted-foreground">
                      {check.completed_queries}/{check.total_queries} queries
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
