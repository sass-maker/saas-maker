"use client";

import { useMemo, useState } from "react";
import { Bot, KeyRound, Save, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CopyButton } from "@/components/copy-button";
import { apiFetchClient, getClientToken } from "@/lib/api-client";
import {
  buildAIGatewaySnippets,
  formatLatency,
  formatTokenCount,
} from "@/lib/ai-gateway";
import type {
  AIProviderConfig,
  AIRequestRecord,
  AIRequestsResponse,
  AIUsageStats,
} from "@saas-maker/contracts";

interface AIGatewayPanelProps {
  projectId: string;
  projectKey: string;
  apiBaseUrl: string;
  initialConfig: AIProviderConfig;
  initialUsage: AIUsageStats;
  initialRequests: AIRequestsResponse;
}

const emptyConfig: AIProviderConfig = {
  ai_base_url: null,
  ai_model: null,
  ai_api_key_configured: false,
  ai_api_key_preview: null,
};

function statusVariant(status: AIRequestRecord["status"]) {
  if (status === "success") return "default";
  if (status === "timeout") return "secondary";
  return "destructive";
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

export function AIGatewayPanel({
  projectId,
  projectKey,
  apiBaseUrl,
  initialConfig,
  initialUsage,
  initialRequests,
}: AIGatewayPanelProps) {
  const [config, setConfig] = useState(initialConfig ?? emptyConfig);
  const [baseUrl, setBaseUrl] = useState(initialConfig.ai_base_url ?? "");
  const [model, setModel] = useState(initialConfig.ai_model ?? "");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const snippets = useMemo(
    () => buildAIGatewaySnippets({ apiBaseUrl, projectKey }),
    [apiBaseUrl, projectKey]
  );

  async function saveConfig() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const token = await getClientToken();
      const body = {
        ai_base_url: baseUrl.trim(),
        ai_model: model.trim(),
        ...(apiKey.trim() ? { ai_api_key: apiKey.trim() } : {}),
      };
      const next = await apiFetchClient<AIProviderConfig>(
        `/v1/ai/config?project_id=${encodeURIComponent(projectId)}`,
        token,
        { method: "PUT", body: JSON.stringify(body) }
      );
      setConfig(next);
      setApiKey("");
      setMessage("Saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save AI config");
    } finally {
      setSaving(false);
    }
  }

  async function clearConfig() {
    setClearing(true);
    setError(null);
    setMessage(null);
    try {
      const token = await getClientToken();
      await apiFetchClient<{ ok: true }>(
        `/v1/ai/config?project_id=${encodeURIComponent(projectId)}`,
        token,
        { method: "DELETE" }
      );
      setConfig(emptyConfig);
      setBaseUrl("");
      setModel("");
      setApiKey("");
      setMessage("Cleared");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear AI config");
    } finally {
      setClearing(false);
    }
  }

  const canSave = Boolean(baseUrl.trim() && model.trim()) && (config.ai_api_key_configured || Boolean(apiKey.trim()));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Requests</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {initialUsage.total_requests}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Success</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {initialUsage.success_count}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Errors</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {initialUsage.error_count}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tokens</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatTokenCount(initialUsage.total_input_tokens + initialUsage.total_output_tokens)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-4 w-4" />
                Provider
              </CardTitle>
              <CardDescription>
                OpenAI-compatible endpoint used by project-authenticated AI calls.
              </CardDescription>
            </div>
            <Badge variant={config.ai_api_key_configured ? "default" : "secondary"}>
              {config.ai_api_key_configured ? "Configured" : "Missing key"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="ai-base-url">Provider URL</Label>
              <Input
                id="ai-base-url"
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder="https://api.openai.com/v1"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ai-model">Default model</Label>
              <Input
                id="ai-model"
                value={model}
                onChange={(event) => setModel(event.target.value)}
                placeholder="gpt-4o-mini"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ai-api-key">Provider API key</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="ai-api-key"
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={
                  config.ai_api_key_preview
                    ? `Leave blank to keep ${config.ai_api_key_preview}`
                    : "sk-..."
                }
              />
              <Button onClick={saveConfig} disabled={!canSave || saving} className="gap-2">
                <Save className="h-4 w-4" />
                {saving ? "Saving" : "Save"}
              </Button>
              <Button
                variant="outline"
                onClick={clearConfig}
                disabled={clearing || (!config.ai_api_key_configured && !baseUrl && !model)}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                {clearing ? "Clearing" : "Clear"}
              </Button>
            </div>
          </div>
          {message && <p className="text-sm text-muted-foreground">{message}</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              Chat
            </CardTitle>
            <CardDescription>Project API key proxy call.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <pre className="overflow-x-auto rounded-md bg-muted p-4 text-xs leading-relaxed">
                <code>{snippets.curl}</code>
              </pre>
              <div className="absolute right-2 top-2">
                <CopyButton value={snippets.curl} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>SDK</CardTitle>
            <CardDescription>Typed project client.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <pre className="overflow-x-auto rounded-md bg-muted p-4 text-xs leading-relaxed">
                <code>{snippets.sdk}</code>
              </pre>
              <div className="absolute right-2 top-2">
                <CopyButton value={snippets.sdk} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Requests</CardTitle>
          <CardDescription>
            Last {initialRequests.data.length} requests, average latency {formatLatency(initialUsage.avg_latency_ms)}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {initialRequests.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">No AI requests yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tokens</TableHead>
                  <TableHead>Latency</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialRequests.data.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>{formatDate(request.created_at)}</TableCell>
                    <TableCell>{request.endpoint}</TableCell>
                    <TableCell>{request.model}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(request.status)}>
                        {request.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {formatTokenCount((request.input_tokens ?? 0) + (request.output_tokens ?? 0))}
                    </TableCell>
                    <TableCell>{formatLatency(request.latency_ms)}</TableCell>
                    <TableCell className="max-w-64 truncate">
                      {request.error_message ?? "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
