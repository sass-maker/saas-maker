"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Clock,
  Zap,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Save,
  Trash2,
  Copy,
  Hash,
} from "lucide-react";
import { getClientToken, apiFetchClient } from "@/lib/api-client";

// ── Types ────────────────────────────────────────────────────────────────────

interface UsageStats {
  total_requests: number;
  success_count: number;
  error_count: number;
  avg_latency_ms: number | null;
  total_input_tokens: number;
  total_output_tokens: number;
}

interface AIConfig {
  ai_base_url: string | null;
  ai_api_key: string | null;
  ai_model: string | null;
}

interface RequestLog {
  id: string;
  endpoint: string;
  model: string;
  status: string;
  latency_ms: number;
  input_tokens: number | null;
  output_tokens: number | null;
  error_message: string | null;
  created_at: string;
}

type Tab = "overview" | "logs" | "config";

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  projectId: string;
  apiKey: string;
}

export function AIGatewayContent({ projectId, apiKey }: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Overview state
  const [usage, setUsage] = useState<UsageStats | null>(null);

  // Logs state
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(0);

  // Config state
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [configForm, setConfigForm] = useState({
    ai_base_url: "",
    ai_api_key: "",
    ai_model: "",
  });
  const [configSaving, setConfigSaving] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getClientToken();
      const [usageRes, configRes] = await Promise.all([
        apiFetchClient<UsageStats>(
          `/v1/ai/usage/${projectId}?days=30`,
          token
        ),
        apiFetchClient<AIConfig>(`/v1/ai/config/${projectId}`, token),
      ]);
      setUsage(usageRes);
      setConfig(configRes);
      setConfigForm({
        ai_base_url: configRes.ai_base_url ?? "",
        ai_api_key: "",
        ai_model: configRes.ai_model ?? "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getClientToken();
      const res = await apiFetchClient<{ data: RequestLog[]; total: number }>(
        `/v1/ai/requests/${projectId}?limit=50&offset=${logsPage * 50}`,
        token
      );
      setLogs(res.data ?? []);
      setLogsTotal(res.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load logs");
    } finally {
      setLoading(false);
    }
  }, [projectId, logsPage]);

  useEffect(() => {
    if (tab === "overview" || tab === "config") {
      fetchOverview();
    } else if (tab === "logs") {
      fetchLogs();
    }
  }, [tab, fetchOverview, fetchLogs]);

  async function handleConfigSave() {
    setConfigSaving(true);
    setConfigError(null);
    try {
      const token = await getClientToken();
      await apiFetchClient(`/v1/ai/config/${projectId}`, token, {
        method: "PUT",
        body: JSON.stringify(configForm),
      });
      await fetchOverview();
    } catch (err) {
      setConfigError(
        err instanceof Error ? err.message : "Failed to save config"
      );
    } finally {
      setConfigSaving(false);
    }
  }

  async function handleConfigDelete() {
    setConfigSaving(true);
    setConfigError(null);
    try {
      const token = await getClientToken();
      await apiFetchClient(`/v1/ai/config/${projectId}`, token, {
        method: "DELETE",
      });
      await fetchOverview();
    } catch (err) {
      setConfigError(
        err instanceof Error ? err.message : "Failed to delete config"
      );
    } finally {
      setConfigSaving(false);
    }
  }

  if (loading && !usage && logs.length === 0) {
    return (
      <div className="rounded-lg bg-zinc-950 text-zinc-50 p-6">
        <div className="flex items-center justify-center py-16">
          <div className="text-zinc-400">Loading AI Gateway...</div>
        </div>
      </div>
    );
  }

  if (error && !usage && logs.length === 0) {
    return (
      <div className="rounded-lg bg-zinc-950 text-zinc-50 p-6">
        <div className="text-center py-16 text-red-400">{error}</div>
      </div>
    );
  }

  const isFreeTier = !config?.ai_base_url;

  return (
    <div className="rounded-lg bg-zinc-950 text-zinc-50 p-6 space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-zinc-900 p-1 w-fit">
        {(["overview", "logs", "config"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
              tab === t
                ? "bg-zinc-700 text-zinc-50"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === "overview" && usage && (
        <>
          {/* Provider badge */}
          <div className="flex items-center gap-2">
            {isFreeTier ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-400">
                <Zap className="h-3 w-3" /> Free Tier (GPT-4o-mini)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 px-3 py-1 text-xs font-medium text-blue-400">
                <Zap className="h-3 w-3" /> {config?.ai_model ?? "Custom"}
              </span>
            )}
          </div>

          {/* Stat cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Requests"
              value={usage.total_requests.toLocaleString()}
              icon={Activity}
            />
            <StatCard
              label="Success Rate"
              value={
                usage.total_requests > 0
                  ? `${((usage.success_count / usage.total_requests) * 100).toFixed(1)}%`
                  : "—"
              }
              icon={CheckCircle2}
            />
            <StatCard
              label="Avg Latency"
              value={
                usage.avg_latency_ms != null
                  ? `${Math.round(usage.avg_latency_ms)}ms`
                  : "—"
              }
              icon={Clock}
            />
            <StatCard
              label="Total Tokens"
              value={(
                usage.total_input_tokens + usage.total_output_tokens
              ).toLocaleString()}
              icon={Hash}
            />
          </div>

          {/* Quick start */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-3">
            <h3 className="text-sm font-medium text-zinc-400">
              Quick Integration
            </h3>
            <CodeSnippet
              label="Chat Completion"
              code={`curl -X POST https://api.sassmaker.com/v1/ai/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "X-Project-Key: ${apiKey}" \\
  -d '{"messages": [{"role": "user", "content": "Hello"}]}'`}
            />
            <CodeSnippet
              label="RAG"
              code={`curl -X POST https://api.sassmaker.com/v1/ai/rag \\
  -H "Content-Type: application/json" \\
  -H "X-Project-Key: ${apiKey}" \\
  -d '{"query": "How do I get started?", "index_id": "YOUR_INDEX_ID"}'`}
            />
          </div>

          {/* Empty state */}
          {usage.total_requests === 0 && (
            <div className="flex flex-col items-center text-center py-8 space-y-3">
              <Zap className="h-12 w-12 text-zinc-600" />
              <h3 className="text-lg font-semibold">No requests yet</h3>
              <p className="text-zinc-400 max-w-md">
                Use the snippets above to make your first AI Gateway request.
              </p>
            </div>
          )}
        </>
      )}

      {/* Logs Tab */}
      {tab === "logs" && (
        <>
          {logs.length === 0 ? (
            <div className="flex flex-col items-center text-center py-16 space-y-3">
              <Activity className="h-12 w-12 text-zinc-600" />
              <h3 className="text-lg font-semibold">No request logs</h3>
              <p className="text-zinc-400">
                Logs will appear here once you start making AI Gateway requests.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border border-zinc-800">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-zinc-900 text-zinc-400 text-left">
                      <th className="px-3 py-2 font-medium">Time</th>
                      <th className="px-3 py-2 font-medium">Endpoint</th>
                      <th className="px-3 py-2 font-medium">Model</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Latency</th>
                      <th className="px-3 py-2 font-medium">Tokens</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr
                        key={log.id}
                        className="border-t border-zinc-800 hover:bg-zinc-900/50"
                      >
                        <td className="px-3 py-2 text-zinc-400 font-mono text-xs whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {log.endpoint}
                        </td>
                        <td className="px-3 py-2 text-zinc-300 text-xs">
                          {log.model}
                        </td>
                        <td className="px-3 py-2">
                          {log.status === "success" ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 text-xs">
                              <CheckCircle2 className="h-3 w-3" /> ok
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 text-red-400 text-xs"
                              title={log.error_message ?? ""}
                            >
                              <XCircle className="h-3 w-3" /> error
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-zinc-400 tabular-nums text-xs">
                          {log.latency_ms}ms
                        </td>
                        <td className="px-3 py-2 text-zinc-400 tabular-nums text-xs">
                          {log.input_tokens != null
                            ? `${log.input_tokens}/${log.output_tokens ?? 0}`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between text-sm text-zinc-400">
                <span>
                  Showing {logsPage * 50 + 1}–
                  {Math.min((logsPage + 1) * 50, logsTotal)} of {logsTotal}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setLogsPage((p) => Math.max(0, p - 1))}
                    disabled={logsPage === 0}
                    className="px-3 py-1 rounded bg-zinc-800 disabled:opacity-40 hover:bg-zinc-700 transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setLogsPage((p) => p + 1)}
                    disabled={(logsPage + 1) * 50 >= logsTotal}
                    className="px-3 py-1 rounded bg-zinc-800 disabled:opacity-40 hover:bg-zinc-700 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Config Tab */}
      {tab === "config" && (
        <div className="space-y-6">
          {isFreeTier && (
            <div className="flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
              <AlertCircle className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-emerald-300">
                  Using Free Tier
                </p>
                <p className="text-xs text-zinc-400 mt-1">
                  Requests are routed through the free AI gateway (GPT-4o-mini).
                  Add your own provider below for more models and higher limits.
                </p>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-4">
            <h3 className="text-sm font-medium text-zinc-400">
              Provider Configuration
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Base URL
                </label>
                <input
                  type="text"
                  placeholder="https://api.openai.com/v1"
                  value={configForm.ai_base_url}
                  onChange={(e) =>
                    setConfigForm((f) => ({
                      ...f,
                      ai_base_url: e.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  API Key
                </label>
                <input
                  type="password"
                  placeholder={
                    config?.ai_api_key ? config.ai_api_key : "sk-..."
                  }
                  value={configForm.ai_api_key}
                  onChange={(e) =>
                    setConfigForm((f) => ({
                      ...f,
                      ai_api_key: e.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Default Model
                </label>
                <input
                  type="text"
                  placeholder="gpt-4o"
                  value={configForm.ai_model}
                  onChange={(e) =>
                    setConfigForm((f) => ({ ...f, ai_model: e.target.value }))
                  }
                  className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
                />
              </div>
            </div>

            {configError && (
              <p className="text-sm text-red-400">{configError}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleConfigSave}
                disabled={configSaving}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
              >
                <Save className="h-4 w-4" />
                {configSaving ? "Saving..." : "Save"}
              </button>
              {!isFreeTier && (
                <button
                  onClick={handleConfigDelete}
                  disabled={configSaving}
                  className="inline-flex items-center gap-2 rounded-md bg-zinc-800 px-4 py-2 text-sm font-medium text-red-400 hover:bg-zinc-700 disabled:opacity-50 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  Reset to Free Tier
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center justify-between mb-1">
        <div className="text-sm text-zinc-400">{label}</div>
        <Icon className="h-4 w-4 text-zinc-500" />
      </div>
      <div className="text-2xl font-bold text-zinc-50">{value}</div>
    </div>
  );
}

function CodeSnippet({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-zinc-500">{label}</span>
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <Copy className="h-3 w-3" />
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="rounded-md bg-zinc-800 border border-zinc-700 p-3 text-xs font-mono text-zinc-300 overflow-x-auto">
        {code}
      </pre>
    </div>
  );
}
