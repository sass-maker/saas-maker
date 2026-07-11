import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const appRoot = process.cwd();
const fleetOpsRoot = resolve(appRoot, "../..");
const fleetRoot = resolve(fleetOpsRoot, "..");

export type CronJob = {
  id: string;
  enabled: boolean;
  cron: string;
  name: string;
  model: string;
  effort: string;
  promptFile: string;
  lockMinutes: number;
  source: string;
  nextHint: string;
  promptSummary: string;
};

export type WifiSummary = {
  health: string;
  latestMbps: number | null;
  averageMbps: number | null;
  sampleCount: number;
  eventCount: number;
  latestSampleAt: string | null;
  latestEventAt: string | null;
  incidents24h: number;
  captivePortalSeen: boolean;
  productPath: string;
  sparkline: number[];
};

const nextHints: Record<string, string> = {
  "daily-fleet-health-sentinel": "Tue-Sun, 08:00 local",
  "weekly-fleet-ops-audit": "Mon, 08:00 local",
  "biweekly-fleet-audit": "Mon, 10:00 local",
  "fleet-backlog-router": "Tue-Fri, 11:00 local",
  "marketing-queue-builder": "Tue/Thu, 15:00 local"
};

function readJsonArray(path: string) {
  if (!existsSync(path)) return [];
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function summarizePrompt(prompt: string) {
  const lines = prompt
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replaceAll("/Users/assistant/Desktop/fleet", "fleet"));
  const purpose = lines.find((line) => /^Run|^Route|^Build/.test(line)) ?? "Scheduled Fleet Ops job.";
  const rules = lines
    .filter((line) => line.startsWith("- No ") || line.includes("Preserve dirty user work"))
    .slice(0, 3)
    .map((line) => line.replace(/^- /, ""));
  return [purpose, ...rules].join(" ");
}

export function getCronJobs(): CronJob[] {
  const cronRoot = resolve(fleetOpsRoot, "automation/codex-cron");
  const jobsPath = resolve(cronRoot, "jobs.tsv");
  const raw = readFileSync(jobsPath, "utf8").trim().split("\n");
  const headers = raw.shift()?.split("\t") ?? [];

  return raw.map((line) => {
    const values = line.split("\t");
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
    const promptPath = resolve(cronRoot, row.prompt_file);
    const prompt = existsSync(promptPath) ? readFileSync(promptPath, "utf8").trim() : "";

    return {
      id: row.id,
      enabled: row.enabled === "yes",
      cron: row.cron,
      name: row.name,
      model: row.model,
      effort: row.effort,
      promptFile: row.prompt_file,
      lockMinutes: Number(row.lock_minutes || 0),
      source: row.source,
      nextHint: nextHints[row.id] ?? row.cron,
      promptSummary: summarizePrompt(prompt)
    };
  });
}

export function getWifiSummary(): WifiSummary {
  const wifiRoot = resolve(fleetRoot, "wifi-watch");
  const events = readJsonArray(resolve(wifiRoot, "data/events.json"));
  const samples = readJsonArray(resolve(wifiRoot, "data/samples.json"));
  const latestSample = samples.at(-1) as Record<string, unknown> | undefined;
  const latestEvent = events.at(-1) as Record<string, unknown> | undefined;
  const mbpsValues = samples
    .map((sample) => Number((sample as Record<string, unknown>).mbps))
    .filter((value) => Number.isFinite(value));
  const averageMbps =
    mbpsValues.length > 0
      ? Math.round((mbpsValues.reduce((sum, value) => sum + value, 0) / mbpsValues.length) * 10) / 10
      : null;
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const incidents24h = events.filter((event) => {
    const item = event as Record<string, unknown>;
    const at = Date.parse(String(item.at ?? ""));
    const type = String(item.type ?? "");
    return at >= since && ["bandwidth_lost", "disconnected", "health_changed"].includes(type);
  }).length;
  const sparkline = mbpsValues.slice(-36).map((value) => Math.max(0, Math.min(100, Math.round(value))));

  return {
    health: String(latestSample?.health ?? "unknown"),
    latestMbps: Number.isFinite(Number(latestSample?.mbps)) ? Number(latestSample?.mbps) : null,
    averageMbps,
    sampleCount: samples.length,
    eventCount: events.length,
    latestSampleAt: typeof latestSample?.at === "string" ? latestSample.at : null,
    latestEventAt: typeof latestEvent?.at === "string" ? latestEvent.at : null,
    incidents24h,
    captivePortalSeen: samples.some((sample) => Boolean((sample as Record<string, unknown>).captivePortal)),
    productPath: "fleet/wifi-watch",
    sparkline
  };
}
