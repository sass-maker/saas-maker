import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

const appRoot = process.cwd();
const fleetOpsRoot = resolve(appRoot, "../..");
const fleetRoot = resolve(fleetOpsRoot, "..");
const saasMakerRoot = resolve(fleetRoot, "saas-maker");

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

export type FleetTask = {
  id: string;
  projectSlug: string;
  title: string;
  status: string;
  priority: string;
  size: string | null;
  type: string | null;
  blocked: boolean;
  claimedBy: string | null;
  updatedAt: string | null;
};

export type FleetProject = {
  slug: string;
  title: string;
  desc: string;
  tier: string;
  lane: string;
  repoUrl: string | null;
  homepage: string | null;
  localPath: string;
  branch: string | null;
  dirtyCount: number;
  smokeStatus: string;
  smokeFailures: number;
  workflowStatus: string;
  openTasks: FleetTask[];
  blockedTasks: number;
  highPriorityTasks: number;
  doneTasks: number;
  state: "needs-attention" | "active" | "blocked" | "local-changes" | "steady";
  stateLabel: string;
  updatedAt: string | null;
};

export type FleetConnection = {
  from: string;
  to: string;
  type: string;
  detail: string;
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

function readJsonObject(path: string) {
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function safeGit(args: string[], cwd: string) {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function publicRepoUrl(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value
    .replace(/^git@github.com:/, "https://github.com/")
    .replace(/\.git$/, "");
  return normalized.startsWith("https://github.com/") ? normalized : value;
}

function titleize(slug: string) {
  return slug
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
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

export function getSnapshotInfo() {
  const tasks = readJsonObject(resolve(saasMakerRoot, ".symphony/tasks.json")) as { syncedAt?: string };
  const smoke = readJsonObject(resolve(saasMakerRoot, ".symphony/fleet-production-smoke/latest.json")) as {
    generatedAt?: string;
  };
  const audit = readJsonObject(resolve(saasMakerRoot, ".symphony/fleet-audit/latest.json")) as {
    generatedAt?: string;
  };

  return {
    generatedAt: new Date().toISOString(),
    refreshCadence: "Every 5 minutes while this Mac is awake; manual refresh via ops-console restart.",
    tasksSyncedAt: tasks.syncedAt ?? null,
    smokeGeneratedAt: smoke.generatedAt ?? null,
    auditGeneratedAt: audit.generatedAt ?? null
  };
}

export function getFleetTasks(): FleetTask[] {
  const raw = readJsonObject(resolve(saasMakerRoot, ".symphony/tasks.json")) as { tasks?: Array<Record<string, unknown>> };
  return (raw.tasks ?? []).map((task) => ({
    id: String(task.id ?? ""),
    projectSlug: String(task.project_slug ?? "unassigned"),
    title: String(task.title ?? "Untitled task"),
    status: String(task.status ?? "unknown"),
    priority: String(task.priority ?? "unknown"),
    size: task.size ? String(task.size) : null,
    type: task.task_type ? String(task.task_type) : null,
    blocked: Boolean(task.blocked_on_user),
    claimedBy: task.claimed_by ? String(task.claimed_by) : null,
    updatedAt: task.updated_at ? String(task.updated_at) : null
  }));
}

export function getFleetProjects(): FleetProject[] {
  const catalog = readJsonObject(resolve(saasMakerRoot, "foundry.projects.json")) as Record<
    string,
    { desc?: string; url?: string; tier?: string }
  >;
  const audit = readJsonObject(resolve(saasMakerRoot, ".symphony/fleet-audit/latest.json")) as {
    projects?: Array<Record<string, any>>;
  };
  const smoke = readJsonObject(resolve(saasMakerRoot, ".symphony/fleet-production-smoke/latest.json")) as {
    summary?: Array<Record<string, unknown>>;
  };
  const tasks = getFleetTasks();
  const auditBySlug = new Map((audit.projects ?? []).map((project) => [String(project.slug), project]));
  const smokeBySlug = new Map((smoke.summary ?? []).map((item) => [String(item.project), item]));
  const slugs = [...new Set([...Object.keys(catalog), "fleet-ops", "wifi-watch"])]
    .filter((slug) => Boolean(catalog[slug]) || existsSync(resolve(fleetRoot, slug)))
    .sort((a, b) => a.localeCompare(b));

  return slugs.map((slug) => {
    const root = resolve(fleetRoot, slug);
    const pkg = readJsonObject(resolve(root, "package.json")) as { homepage?: string; name?: string; description?: string };
    const meta = catalog[slug] ?? {};
    const auditProject = auditBySlug.get(slug);
    const smokeProject = smokeBySlug.get(slug);
    const projectTasks = tasks.filter((task) => task.projectSlug === slug);
    const openTasks = projectTasks
      .filter((task) => !["done", "closed", "cancelled"].includes(task.status))
      .sort((a, b) => {
        const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
        return (priorityOrder[a.priority] ?? 5) - (priorityOrder[b.priority] ?? 5);
      });
    const branch = existsSync(resolve(root, ".git")) ? safeGit(["branch", "--show-current"], root) || null : null;
    const dirtyCount = existsSync(resolve(root, ".git"))
      ? safeGit(["status", "--short"], root).split("\n").filter(Boolean).length
      : 0;
    const smokeStatus = String(smokeProject?.status ?? "unknown");
    const smokeFailures = Number(smokeProject?.failures ?? 0);
    const latestWorkflow = auditProject?.github?.workflows?.[0];
    const workflowStatus = latestWorkflow
      ? `${latestWorkflow.workflowName}: ${latestWorkflow.conclusion ?? latestWorkflow.status}`
      : "unknown";
    const blockedTasks = openTasks.filter((task) => task.blocked).length;
    const highPriorityTasks = openTasks.filter((task) => task.priority === "high").length;
    const doneTasks = projectTasks.filter((task) => task.status === "done").length;
    const updatedAt = openTasks[0]?.updatedAt ?? projectTasks[0]?.updatedAt ?? null;
    let state: FleetProject["state"] = "steady";
    if (smokeStatus === "fail" || highPriorityTasks > 0) state = "needs-attention";
    else if (blockedTasks > 0) state = "blocked";
    else if (openTasks.length > 0) state = "active";
    else if (dirtyCount > 0) state = "local-changes";
    const stateLabel = {
      "needs-attention": "Needs attention",
      active: "Active",
      blocked: "Blocked",
      "local-changes": "Local changes",
      steady: "Steady"
    }[state];

    return {
      slug,
      title: pkg.name ? titleize(String(pkg.name).replace(/^@[^/]+\//, "")) : titleize(slug),
      desc: meta.desc ?? pkg.description ?? "No description recorded yet.",
      tier: meta.tier ?? (slug === "fleet-ops" || slug === "wifi-watch" ? "ops" : "unknown"),
      lane: auditProject?.businessLane ?? (meta.tier === "core" ? "Core" : meta.tier === "active-ai" ? "Active AI" : "Ops"),
      repoUrl: publicRepoUrl(meta.url) ?? publicRepoUrl(safeGit(["remote", "get-url", "origin"], root)) ?? null,
      homepage: pkg.homepage ?? null,
      localPath: existsSync(root) ? `fleet/${slug}` : "not checked out",
      branch,
      dirtyCount,
      smokeStatus,
      smokeFailures,
      workflowStatus,
      openTasks,
      blockedTasks,
      highPriorityTasks,
      doneTasks,
      state,
      stateLabel,
      updatedAt
    };
  });
}

export function getFleetConnections(): FleetConnection[] {
  const projects = getFleetProjects();
  const registered = projects.filter((project) => !["fleet-ops", "wifi-watch", "saas-maker"].includes(project.slug));
  const edges: FleetConnection[] = [
    {
      from: "fleet-ops",
      to: "saas-maker",
      type: "control",
      detail: "Fleet Ops cron and agents run Foundry audits, task routing, smoke checks, and marketing queue work."
    },
    {
      from: "wifi-watch",
      to: "fleet-ops",
      type: "telemetry",
      detail: "Wi-Fi Watch feeds the public console network snapshot and validates the machine access layer."
    },
    {
      from: "reel-pipeline",
      to: "saas-maker",
      type: "marketing",
      detail: "Reel Pipeline consumes accepted Marketing Queue work and writes rendered artifact/posting status back."
    },
    {
      from: "free-ai",
      to: "resume-tailor",
      type: "ai-gateway",
      detail: "RolePatch records free-ai as the AI gateway/chokepoint for model traffic."
    }
  ];

  for (const project of registered) {
    edges.push({
      from: "saas-maker",
      to: project.slug,
      type: "registry",
      detail: `Foundry tracks ${project.slug} metadata, tasks, smoke status, and fleet audit state.`
    });
  }

  for (const project of projects.filter((project) => project.openTasks.length > 0)) {
    const noun = project.openTasks.length === 1 ? "task currently attaches" : "tasks currently attach";
    edges.push({
      from: "fleet-ops",
      to: project.slug,
      type: "work",
      detail: `${project.openTasks.length} open Symphony ${noun} to ${project.slug}.`
    });
  }

  return edges;
}
