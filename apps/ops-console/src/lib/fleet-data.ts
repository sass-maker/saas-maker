import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

const appRoot = process.cwd();
const fleetOpsRoot = resolve(appRoot, "../..");
const fleetRoot = resolve(fleetOpsRoot, "..");
const saasMakerRoot = resolve(fleetRoot, "saas-maker");

const localDirBySlug: Record<string, string> = {
  "alive-ville": "aliveville",
  posttrainllm: "tinygpt"
};

const canonicalSlugByAlias: Record<string, string> = {
  CodeVetter: "codevetter",
  "ai-game": "aliveville",
  "alive-ville": "aliveville",
  anime_list: "anime-list",
  linkchat: "karte",
  tinygpt: "posttrainllm",
  "resume-tailor": "rolepatch"
};

const productTitleBySlug: Record<string, string> = {
  aliveville: "AliveVille",
  "anime-list": "MAL Explorer",
  codevetter: "CodeVetter",
  drank: "drank",
  "email-manager": "Email Manager",
  "fleet-ops": "Fleet Ops",
  "free-ai": "Free AI",
  "high-signal": "High Signal",
  karte: "Karte",
  "knowledge-base": "Knowledge Base",
  looptv: "LoopTV",
  pace: "Pace",
  reader: "Reader",
  "reel-pipeline": "Reel Pipeline",
  "research-papers": "Research Papers",
  rolepatch: "RolePatch",
  "saas-maker": "SaaS Maker",
  starboard: "Starboard",
  "significanthobbies": "Significant Hobbies",
  "swe-interview-prep": "SWE Interview Prep",
  posttrainllm: "posttrainllm",
  "wifi-watch": "Wi-Fi Watch"
};

function canonicalProjectSlug(slug: string) {
  return canonicalSlugByAlias[slug] ?? slug;
}

function canonicalProductText(value: string) {
  return value
    .replace(/\btinygpt\b/gi, "posttrainllm")
    .replace(/\blinkchat\b/gi, "Karte")
    .replace(/\bresume-tailor\b/gi, "RolePatch")
    .replace(/\bai-game\b/gi, "AliveVille")
    .replace(/\binterview-coder\b/gi, "SWE Interview Prep");
}

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
  lane: "build" | "marketing";
};

export type FleetCommit = {
  hash: string;
  shortHash: string;
  committedAt: string;
  subject: string;
};

export type FleetDevlog = {
  projectSlug: string;
  projectTitle: string;
  repoUrl: string | null;
  commits: FleetCommit[];
};

export type DomainIntelligence = {
  domain: string;
  domainRating: number | null;
  domainRatingUpdatedAt: string | null;
  performanceScore: number | null;
  lcpMs: number | null;
  cls: number | null;
  psiUpdatedAt: string | null;
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
  localDir: string;
  checkedOut: boolean;
  branch: string | null;
  dirtyCount: number;
  hostingKind: "machine" | "cloudflare" | "external" | "local" | "unknown";
  hostingLabel: string;
  hostingDetail: string;
  smokeStatus: string;
  smokeFailures: number;
  workflowStatus: string;
  openTasks: FleetTask[];
  blockedTasks: number;
  highPriorityTasks: number;
  doneTasks: number;
  taskSummary: string;
  state: "needs-attention" | "active" | "blocked" | "local-changes" | "steady";
  stateLabel: string;
  updatedAt: string | null;
};

export type AgentSurface = {
  name: string;
  status: "running" | "configured" | "missing" | "stopped" | "unknown";
  detail: string;
};

export type FleetNode = {
  id: string;
  label: string;
  role: string;
  status: "online" | "needs-setup" | "offline" | "planned";
  host: string;
  operator: string;
  publicWorkloads: string[];
  privateAccess: AgentSurface[];
  agents: AgentSurface[];
  notes: string[];
};

export type MarketingPipeline = {
  updatedAt: string | null;
  proof: { brand: string; score: number; verdict: string; durationSeconds: number; sourceUrl: string } | null;
  stages: Array<{ name: string; state: "ready" | "blocked" | "not-configured"; detail: string }>;
  brands: Array<{
    slug: string;
    name: string;
    domain: string;
    sourceReady: boolean;
    sourceDetail: string;
    channels: string[];
    mappedChannels: string[];
    connectedChannels: string[];
    postingState: "ready" | "blocked";
  }>;
};

export type LearningSummary = {
  url: string;
  generatedAt: string | null;
  sourceCount: number;
  freshCount: number;
  staleCount: number;
  pendingCount: number;
  activeSessionCount: number;
  completedSessionCount: number;
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

function safeExec(command: string, args: string[] = [], timeout = 3500) {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout
    }).trim();
  } catch (error) {
    const err = error as { stdout?: Buffer | string; stderr?: Buffer | string; message?: string };
    const stdout = err.stdout ? String(err.stdout).trim() : "";
    const stderr = err.stderr ? String(err.stderr).trim() : "";
    return stdout || stderr || err.message || "";
  }
}

function commandExists(command: string) {
  try {
    execFileSync("zsh", ["-lc", `command -v ${command}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 1200
    });
    return true;
  } catch {
    return false;
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

function projectRoot(slug: string) {
  return resolve(fleetRoot, localDirBySlug[slug] ?? slug);
}

function projectLocalPath(slug: string) {
  const localDir = localDirBySlug[slug] ?? slug;
  return existsSync(resolve(fleetRoot, localDir)) ? `fleet/${localDir}` : "not checked out";
}

function getHosting(project: {
  slug: string;
  root: string;
  checkedOut: boolean;
  pkg: Record<string, unknown>;
  homepage: string | null;
  verifiedSite: { url: string; platform: string } | null;
}) {
  if (project.slug === "fleet-ops") {
    return {
      hostingKind: "machine" as const,
      hostingLabel: "Machine-hosted",
      hostingDetail: "This Mac serves the Fleet info console through Cloudflare Tunnel."
    };
  }

  if (project.slug === "wifi-watch") {
    return {
      hostingKind: "local" as const,
      hostingLabel: "Machine telemetry",
      hostingDetail: "Local Wi-Fi telemetry feeds the console; it is not a separate public app host."
    };
  }

  if (project.verifiedSite) {
    return {
      hostingKind: "cloudflare" as const,
      hostingLabel: project.verifiedSite.platform,
      hostingDetail: `Live URL verified ${project.verifiedSite.url}`
    };
  }

  if (!project.checkedOut) {
    return {
      hostingKind: "unknown" as const,
      hostingLabel: "Not checked out",
      hostingDetail: "Cataloged in Foundry, but this machine has no local checkout to inspect."
    };
  }

  const hasWranglerConfig =
    existsSync(resolve(project.root, "wrangler.toml")) ||
    existsSync(resolve(project.root, "wrangler.jsonc")) ||
    existsSync(resolve(project.root, "wrangler.json"));
  const scripts = project.pkg && typeof project.pkg === "object" ? ((project.pkg as { scripts?: unknown }).scripts ?? {}) : {};
  const scriptText = JSON.stringify(scripts).toLowerCase();

  if (hasWranglerConfig || scriptText.includes("wrangler") || scriptText.includes("pages deploy")) {
    return {
      hostingKind: "cloudflare" as const,
      hostingLabel: "Cloudflare",
      hostingDetail: hasWranglerConfig
        ? "Local deploy config points at Cloudflare Workers or Pages."
        : "Package scripts deploy through Cloudflare tooling."
    };
  }

  if (project.homepage) {
    return {
      hostingKind: "external" as const,
      hostingLabel: "External/own domain",
      hostingDetail: "Has a public homepage, but no local Cloudflare deploy config was detected here."
    };
  }

  return {
    hostingKind: "local" as const,
    hostingLabel: "Local/dev",
    hostingDetail: "No public deploy target detected from this checkout."
  };
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
    refreshCadence: "Machine heartbeat updates every minute; project pages rebuild only when published.",
    tasksSyncedAt: tasks.syncedAt ?? null,
    smokeGeneratedAt: smoke.generatedAt ?? null,
    auditGeneratedAt: audit.generatedAt ?? null
  };
}

export function getFleetTasks(): FleetTask[] {
  const raw = readJsonObject(resolve(saasMakerRoot, ".symphony/tasks.json")) as { tasks?: Array<Record<string, unknown>> };
  return (raw.tasks ?? []).map((task) => {
    const rawTitle = String(task.title ?? "Untitled task");
    return {
      id: String(task.id ?? ""),
      projectSlug: canonicalProjectSlug(String(task.project_slug ?? "unassigned")),
      title: canonicalProductText(rawTitle),
      status: String(task.status ?? "unknown"),
      priority: String(task.priority ?? "unknown"),
      size: task.size ? String(task.size) : null,
      type: task.task_type ? String(task.task_type) : null,
      blocked: Boolean(task.blocked_on_user),
      claimedBy: task.claimed_by ? String(task.claimed_by) : null,
      updatedAt: task.updated_at ? String(task.updated_at) : null,
      lane: /\bmarketing\b/i.test(rawTitle) ? "marketing" : "build"
    };
  });
}

export function getFleetDevlog(limit = 3): FleetDevlog[] {
  return getFleetProjects()
    .filter((project) => project.checkedOut)
    .map((project) => {
      const raw = safeGit(["log", `-${limit}`, "--format=%H%x09%h%x09%aI%x09%s"], projectRoot(project.slug));
      const commits = raw.split("\n").filter(Boolean).flatMap((line) => {
        const [hash, shortHash, committedAt, ...subjectParts] = line.split("\t");
        if (!hash || !shortHash || !committedAt) return [];
        return [{ hash, shortHash, committedAt, subject: subjectParts.join("\t") || "Untitled commit" }];
      });
      return {
        projectSlug: project.slug,
        projectTitle: project.title,
        repoUrl: project.repoUrl,
        commits
      };
    })
    .filter((entry) => entry.commits.length > 0)
    .sort((left, right) => Date.parse(right.commits[0]?.committedAt ?? "") - Date.parse(left.commits[0]?.committedAt ?? ""));
}

export function getDomainIntelligence(): DomainIntelligence[] {
  const drank = readJsonObject(resolve(fleetRoot, "drank/data/fleet-dr.json")) as {
    lastUpdated?: string | null;
    domains?: Record<string, { history?: Array<{ ts?: number; dr?: number }> }>;
  };
  const dbPath = resolve(process.env.HOME ?? "", ".psi-swarm/history.db");
  const rawRuns = existsSync(dbPath)
    ? safeExec("sqlite3", ["-json", dbPath, "SELECT url, started_at, lcp, cls, performance_score FROM runs WHERE error IS NULL AND tag = 'fleet-weekly' ORDER BY started_at DESC LIMIT 200"], 5000)
    : "";
  let runs: Array<{ url?: string; started_at?: number; lcp?: number; cls?: number; performance_score?: number }> = [];
  try { runs = JSON.parse(rawRuns || "[]"); } catch {}
  const domains = Object.entries(drank.domains ?? {}).map(([domain, entry]) => {
    const latestRating = (entry.history ?? []).at(-1);
    const domainRuns = runs.filter((run) => {
      try { return new URL(String(run.url)).hostname.replace(/^www\./, "") === domain; } catch { return false; }
    }).slice(0, 3);
    const median = (values: number[]) => {
      if (!values.length) return null;
      const sorted = [...values].sort((left, right) => left - right);
      return sorted[Math.floor(sorted.length / 2)] ?? null;
    };
    const performanceScore = median(domainRuns.map((run) => Number(run.performance_score)).filter(Number.isFinite));
    return {
      domain,
      domainRating: typeof latestRating?.dr === "number" ? latestRating.dr : null,
      domainRatingUpdatedAt: latestRating?.ts ? new Date(latestRating.ts).toISOString() : drank.lastUpdated ?? null,
      performanceScore: performanceScore !== null && performanceScore <= 1 ? performanceScore * 100 : performanceScore,
      lcpMs: median(domainRuns.map((run) => Number(run.lcp)).filter(Number.isFinite)),
      cls: median(domainRuns.map((run) => Number(run.cls)).filter(Number.isFinite)),
      psiUpdatedAt: domainRuns[0]?.started_at ? new Date(Number(domainRuns[0].started_at)).toISOString() : null
    };
  });
  return domains.sort((left, right) => left.domain.localeCompare(right.domain));
}

export function getFleetProjects(): FleetProject[] {
  const rawCatalog = readJsonObject(resolve(saasMakerRoot, "foundry.projects.json")) as Record<
    string,
    { desc?: string; url?: string; tier?: string }
  >;
  const catalog = Object.fromEntries(
    Object.entries(rawCatalog).map(([slug, meta]) => [canonicalProjectSlug(slug), meta])
  ) as Record<string, { desc?: string; url?: string; tier?: string }>;
  const audit = readJsonObject(resolve(saasMakerRoot, ".symphony/fleet-audit/latest.json")) as {
    projects?: Array<Record<string, any>>;
  };
  const smoke = readJsonObject(resolve(saasMakerRoot, ".symphony/fleet-production-smoke/latest.json")) as {
    summary?: Array<Record<string, unknown>>;
  };
  const tasks = getFleetTasks();
  const siteRegistry = readJsonObject(resolve(fleetOpsRoot, "config/project-sites.json")) as {
    projects?: Record<string, { url?: string; platform?: string }>;
  };
  const auditBySlug = new Map((audit.projects ?? []).map((project) => [canonicalProjectSlug(String(project.slug)), project]));
  const smokeBySlug = new Map((smoke.summary ?? []).map((item) => [canonicalProjectSlug(String(item.project)), item]));
  const slugs = [...new Set([...Object.keys(catalog), "fleet-ops", "wifi-watch"])]
    .filter((slug) => Boolean(catalog[slug]) || existsSync(projectRoot(slug)))
    .sort((a, b) => a.localeCompare(b));

  return slugs.map((slug) => {
    const root = projectRoot(slug);
    const pkg = readJsonObject(resolve(root, "package.json")) as { homepage?: string; name?: string; description?: string };
    const meta = catalog[slug] ?? {};
    const localDir = localDirBySlug[slug] ?? slug;
    const checkedOut = existsSync(root);
    const registeredSite = siteRegistry.projects?.[slug];
    const verifiedSite = registeredSite?.url
      ? { url: registeredSite.url, platform: registeredSite.platform ?? "Cloudflare" }
      : null;
    const homepage = verifiedSite?.url ?? pkg.homepage ?? null;
    const hosting = getHosting({ slug, root, checkedOut, pkg, homepage, verifiedSite });
    const auditProject = auditBySlug.get(slug);
    const smokeProject = smokeBySlug.get(slug);
    const projectTasks = tasks.filter((task) => task.projectSlug === slug && task.lane === "build");
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
    const taskSummary = `${openTasks.length} open / ${highPriorityTasks} high / ${blockedTasks} blocked / ${doneTasks} done`;
    const updatedAt = openTasks[0]?.updatedAt ?? projectTasks[0]?.updatedAt ?? null;
    let state: FleetProject["state"] = "steady";
    if (smokeStatus === "fail" || openTasks.some((task) => /^\[fleet-(failure|smoke|ci)\]/i.test(task.title))) state = "needs-attention";
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
      title: productTitleBySlug[slug] ?? (pkg.name ? titleize(String(pkg.name).replace(/^@[^/]+\//, "")) : titleize(slug)),
      desc: meta.desc ?? pkg.description ?? "No description recorded yet.",
      tier: meta.tier ?? (slug === "fleet-ops" || slug === "wifi-watch" ? "ops" : "unknown"),
      lane: auditProject?.businessLane ?? (meta.tier === "core" ? "Core" : meta.tier === "active-ai" ? "Active AI" : "Ops"),
      repoUrl: publicRepoUrl(meta.url) ?? publicRepoUrl(safeGit(["remote", "get-url", "origin"], root)) ?? null,
      homepage,
      localPath: projectLocalPath(slug),
      localDir,
      checkedOut,
      branch,
      dirtyCount,
      ...hosting,
      smokeStatus,
      smokeFailures,
      workflowStatus,
      openTasks,
      blockedTasks,
      highPriorityTasks,
      doneTasks,
      taskSummary,
      state,
      stateLabel,
      updatedAt
    };
  });
}

export function getFleetNodes(): FleetNode[] {
  const host = "private tailnet node";
  const label = "Primary Fleet machine";
  const operator = "private";
  const openClawStatus = commandExists("openclaw") ? safeExec("openclaw", ["status", "--json"], 5000) : "";
  const openClawTelegram = commandExists("openclaw") ? safeExec("zsh", ["-lc", "openclaw channels list --all 2>/dev/null | sed -n '/Telegram/p'"], 5000) : "";
  const hermesGateway = commandExists("hermes") ? safeExec("hermes", ["gateway", "status"], 5000) : "";
  const hermesStatus = commandExists("hermes") ? safeExec("hermes", ["status"], 5000) : "";
  const tailscaleStatus = commandExists("tailscale")
    ? safeExec(resolve(fleetOpsRoot, "scripts/agent-bin/mobile-control"), ["tailscale-status"], 2500)
    : "";
  const tmateStatus = safeExec(resolve(fleetOpsRoot, "scripts/agent-bin/mobile-control"), ["tmate-status"], 2500);
  const consoleStatus = safeExec("curl", ["-fsS", "--max-time", "2", "http://127.0.0.1:4329/healthz"], 2500);
  const grokStatus = commandExists("grok") ? safeExec("grok", ["models"], 10000) : "";

  const openClawRunning = openClawStatus.includes('"runtimeVersion"') || openClawStatus.includes("Dashboard");
  const hermesRunning = hermesGateway.includes("Gateway is supervised") || hermesGateway.includes("running");
  const openClawTelegramConfigured = /Telegram:\s+installed,\s+configured,\s+enabled/i.test(openClawTelegram);
  const hermesTelegramConfigured = /Telegram\s+✓|Telegram\s+configured/i.test(hermesStatus);
  const tailscaleRunning = Boolean(tailscaleStatus) && !/failed to connect|not running|stopped/i.test(tailscaleStatus);
  const tmateRunning = /^\s*active\b/im.test(tmateStatus);
  const consoleRunning = consoleStatus === "ok";
  const grokReady = commandExists("grok") && !/not authenticated|unauthenticated|login/i.test(grokStatus);
  const devinReady = commandExists("devin") || commandExists("devin-cli");
  const devinAdapter = existsSync(resolve(fleetOpsRoot, "scripts/agent-bin/devin-session.mjs"));

  return [
    {
      id: "primary-mac",
      label,
      role: "Primary Fleet node",
      status: openClawRunning && consoleRunning ? "online" : "needs-setup",
      host,
      operator,
      publicWorkloads: ["Fleet Ops console", "Wi-Fi Watch telemetry"],
      privateAccess: [
        {
          name: "Tailscale SSH",
          status: tailscaleRunning ? "running" : commandExists("tailscale") ? "stopped" : "missing",
          detail: tailscaleRunning
            ? "Tailnet connected; use Tailscale SSH from mobile once ACLs allow it."
            : "Tailscale CLI is installed, but the local service is not connected."
        },
        {
          name: "Emergency terminal fallback",
          status: tmateRunning ? "running" : commandExists("tmate") ? "stopped" : "missing",
          detail: tmateRunning
            ? "A deprecated temporary session is active; credential links remain private."
            : "tmate is disabled by default. Tailscale SSH is the durable mobile path."
        }
      ],
      agents: [
        {
          name: "OpenClaw",
          status: openClawRunning ? "running" : commandExists("openclaw") ? "stopped" : "missing",
          detail: openClawTelegramConfigured
            ? "Gateway running with Telegram configured."
            : "Gateway running; Telegram plugin is installed but still needs bot token and allowlist."
        },
        {
          name: "Hermes",
          status: hermesRunning ? "running" : commandExists("hermes") ? "stopped" : "missing",
          detail: hermesTelegramConfigured
            ? "Optional backup/persistent lane is running with Telegram configured."
            : "Optional lane only; configure Telegram and a model provider when a recurring job needs Hermes."
        },
        {
          name: "Fleet Ops console",
          status: consoleRunning ? "running" : "stopped",
          detail: consoleRunning ? "Local dashboard service is healthy." : "Local dashboard service is down."
        },
        {
          name: "Grok",
          status: grokReady ? "configured" : commandExists("grok") ? "stopped" : "missing",
          detail: grokReady
            ? "Grok CLI is installed and authenticated for teammate review/parallel attempts."
            : commandExists("grok")
              ? "Grok CLI is installed, but authentication is missing."
              : "Grok CLI is not installed on this node."
        },
        {
          name: "Devin",
          status: devinReady ? "configured" : devinAdapter ? "stopped" : "missing",
          detail: devinReady
            ? "Devin CLI is available as an optional explicit-spend teammate."
            : devinAdapter
              ? "Fleet API adapter is installed; service-user credentials and explicit spend approval are still required."
              : "No Devin integration detected; keep it optional and invoke only with explicit spend approval."
        }
      ],
      notes: [
        "This is the only machine currently hosting a public Fleet surface.",
        "Most products are Cloudflare-hosted; project pages show the per-product hosting split.",
        "Secrets and private terminal links are deliberately excluded from the public dashboard."
      ]
    }
  ];
}

export function getMarketingPipeline(): MarketingPipeline {
  const pipelineRoot = resolve(fleetRoot, "reel-pipeline");
  const rawConfig = readJsonObject(resolve(pipelineRoot, "config/brand-channels.json")) as {
    brands?: Record<string, {
      name?: string;
      domain?: string;
      channels?: string[];
      accountMappings?: Record<string, string>;
    }>;
  };
  const rawProof = readJsonObject(resolve(pipelineRoot, "config/brand-video-proof.json")) as {
    generatedAt?: string;
    brand?: string;
    sourceUrl?: string;
    media?: { durationSeconds?: number };
    quality?: { overall?: number; verdict?: string };
  };
  const socialReadiness = readJsonObject(resolve(process.env.HOME ?? "", "Library/Application Support/Fleet Ops/marketing/readiness.json")) as {
    accounts?: Array<{ brand?: string; channel?: string; ready?: boolean }>;
    summary?: { totalAccounts?: number; connectedAccounts?: number; infrastructureReady?: boolean };
  };
  const sources: Record<string, { path: string; detail: string }> = {
    "high-signal": {
      path: resolve(fleetRoot, "high-signal/data/personal-reel-briefs.jsonl"),
      detail: "Personal reel briefs and High Signal evidence URLs"
    },
    significanthobbies: {
      path: resolve(fleetRoot, "significanthobbies/src/lib/blog-posts.ts"),
      detail: "Published editorial and structured hobby posts"
    },
    "swe-interview-prep": {
      path: resolve(fleetRoot, "swe-interview-prep/docs"),
      detail: "Learning tracks and project-backed learning docs"
    }
  };
  const brands = Object.entries(rawConfig.brands ?? {}).map(([slug, brand]) => {
    const source = sources[slug];
    const mappedChannels = Object.keys(brand.accountMappings ?? {}).filter((channel) => Boolean(brand.accountMappings?.[channel]));
    const channels = brand.channels ?? [];
    const connectedChannels = (socialReadiness.accounts ?? [])
      .filter((entry) => entry.brand === slug && entry.ready && entry.channel)
      .map((entry) => String(entry.channel));
    return {
      slug,
      name: brand.name ?? titleize(slug),
      domain: brand.domain ?? "",
      sourceReady: Boolean(source && existsSync(source.path)),
      sourceDetail: source?.detail ?? "Source adapter not registered",
      channels,
      mappedChannels,
      connectedChannels,
      postingState: connectedChannels.length === channels.length && channels.length > 0 ? "ready" as const : "blocked" as const
    };
  });
  const contentReady = existsSync(resolve(pipelineRoot, "src/content-package.js"))
    && existsSync(resolve(pipelineRoot, "src/content-extractors.js"));
  const videoReady = existsSync(resolve(pipelineRoot, "src/adapters/brand-video.js"))
    && existsSync(resolve(pipelineRoot, "node_modules/playwright"))
    && existsSync(resolve(pipelineRoot, "tools/kokoro"));
  const distributionReady = existsSync(resolve(pipelineRoot, "src/distribution.js"));
  const totalAccounts = Number(socialReadiness.summary?.totalAccounts ?? brands.reduce((sum, brand) => sum + brand.channels.length, 0));
  const connectedAccounts = Number(socialReadiness.summary?.connectedAccounts ?? 0);

  return {
    updatedAt: rawProof.generatedAt ?? null,
    proof: rawProof.quality?.overall ? {
      brand: rawProof.brand ?? "unknown",
      score: Number(rawProof.quality.overall),
      verdict: rawProof.quality.verdict ?? "unknown",
      durationSeconds: Number(rawProof.media?.durationSeconds ?? 0),
      sourceUrl: rawProof.sourceUrl ?? ""
    } : null,
    stages: [
      { name: "Source extraction", state: contentReady && brands.every((brand) => brand.sourceReady) ? "ready" : "blocked", detail: "Read-only adapters emit proposed, evidence-backed packages." },
      { name: "Approval", state: distributionReady ? "ready" : "blocked", detail: "Media and distribution require separate explicit approvals." },
      { name: "Video factory", state: videoReady && Boolean(rawProof.quality?.overall) ? "ready" : "blocked", detail: "Local Kokoro, Playwright Chromium, and FFmpeg vertical render." },
      { name: "Native publishing", state: connectedAccounts === totalAccounts && totalAccounts > 0 ? "ready" : "blocked", detail: `All ${totalAccounts} account routes are configured; ${connectedAccounts}/${totalAccounts} OAuth connections are ready.` }
    ],
    brands
  };
}

export function getLearningSummary(): LearningSummary {
  const catalog = readJsonObject(resolve(fleetRoot, "swe-interview-prep/src/data/learning-sources.json")) as {
    generatedAt?: string;
    sources?: Array<{ syncStatus?: string }>;
  };
  const control = readJsonObject(resolve(
    process.env.HOME ?? "",
    "Library/Application Support/Fleet Ops/learning-sync/control-state.json"
  )) as { sessions?: Array<{ status?: string }> };
  const sources = Array.isArray(catalog.sources) ? catalog.sources : [];
  const sessions = Array.isArray(control.sessions) ? control.sessions : [];
  const countSources = (status: string) => sources.filter((source) => source.syncStatus === status).length;
  return {
    url: "https://swe-interview-prep.pages.dev/sources",
    generatedAt: catalog.generatedAt ?? null,
    sourceCount: sources.length,
    freshCount: countSources("fresh"),
    staleCount: countSources("stale"),
    pendingCount: countSources("pending"),
    activeSessionCount: sessions.filter((session) => session.status === "started").length,
    completedSessionCount: sessions.filter((session) => session.status === "completed").length
  };
}
