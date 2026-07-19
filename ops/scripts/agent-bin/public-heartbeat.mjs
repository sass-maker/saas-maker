#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { loadMarketingProgram } from "../../lib/marketing-program.mjs";
import { buildMarketingSnapshot } from "../../lib/marketing-snapshot.mjs";

const defaultOutput = `${process.env.HOME}/Library/Application Support/Fleet Ops/ops-console/runtime.json`;
const outputIndex = process.argv.indexOf("--output");
const outputPath = outputIndex >= 0 ? process.argv[outputIndex + 1] : defaultOutput;

if (!outputPath) {
  console.error("usage: public-heartbeat [--output <path>]");
  process.exit(2);
}

function run(command, args = [], timeout = 3000) {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout
    }).trim();
  } catch {
    return "";
  }
}

function commandExists(command) {
  return Boolean(run("/bin/zsh", ["-lc", `command -v ${command}`], 1200));
}

function launchdRunning(label) {
  const uid = typeof process.getuid === "function" ? process.getuid() : 501;
  return /state = running/.test(run("/bin/launchctl", ["print", `gui/${uid}/${label}`], 1500));
}

function tailscaleRunning() {
  if (!commandExists("tailscale")) return false;
  const socket = `${process.env.HOME}/Library/Application Support/Fleet Ops/mobile-control/tailscale/tailscaled.sock`;
  const status = run("tailscale", ["--socket", socket, "status"], 2500) || run("tailscale", ["status"], 2500);
  return Boolean(status) && !/failed to connect|not running|stopped|logged out/i.test(status);
}

function localHealthy() {
  return run("curl", ["-fsS", "--max-time", "2", "http://127.0.0.1:4329/healthz"], 2500) === "ok";
}

function notificationSummary() {
  const root = `${process.env.HOME}/Library/Application Support/Fleet Ops/notifications`;
  const read = (bucket) => {
    const dir = `${root}/${bucket}`;
    if (!existsSync(dir)) return [];
    return readdirSync(dir).filter((name) => name.endsWith(".json")).flatMap((name) => {
      try {
        return [JSON.parse(readFileSync(`${dir}/${name}`, "utf8"))];
      } catch {
        return [];
      }
    });
  };
  const pending = read("pending");
  return {
    pending: pending.length,
    critical: pending.filter((event) => event.severity === "critical").length,
    blocked: pending.filter((event) => event.state === "blocked").length,
    deadLetter: read("dead").length
  };
}

function taskSummary() {
  const raw = run("openclaw", ["tasks", "list", "--json"], 5000);
  if (!raw) return { queued: 0, running: 0, blocked: 0, recentStatus: "unavailable", recentAt: null };
  try {
    const payload = JSON.parse(raw);
    const tasks = Array.isArray(payload) ? payload : payload.tasks || [];
    const recent = [...tasks].sort((left, right) => (right.lastEventAt || 0) - (left.lastEventAt || 0))[0];
    return {
      queued: tasks.filter((task) => task.status === "queued").length,
      running: tasks.filter((task) => task.status === "running").length,
      blocked: tasks.filter((task) => ["timed_out", "lost"].includes(task.status)).length,
      recentStatus: recent?.status || "none",
      recentAt: recent?.lastEventAt ? new Date(recent.lastEventAt).toISOString() : null
    };
  } catch {
    return { queued: 0, running: 0, blocked: 0, recentStatus: "unavailable", recentAt: null };
  }
}

function marketingSummary() {
  const readinessPath = `${process.env.HOME}/Library/Application Support/Fleet Ops/marketing/readiness.json`;
  let readiness = {};
  try { readiness = JSON.parse(readFileSync(readinessPath, "utf8")); } catch {}
  const registry = loadMarketingProgram("/Users/assistant/Desktop/fleet/fleet-ops/config/marketing-program.json");
  const cli = "/Users/assistant/Desktop/fleet/saas-maker/packages/cli/dist/index.js";
  const raw = existsSync(cli)
    ? run(process.execPath, [cli, "api", "GET", "/v1/marketing/posts", "--auth", "session", "--query", "limit=500", "--raw", "--quiet"], 15000)
    : "";
  let posts = [];
  try {
    const start = raw.indexOf("{");
    posts = JSON.parse(start >= 0 ? raw.slice(start) : raw).data || [];
  } catch {}
  const snapshot = buildMarketingSnapshot(posts, registry);
  const brands = registry.projects.filter((project) => project.channels.length > 0).map((program) => {
    const slug = program.slug;
    const accounts = (readiness.accounts || []).filter((account) => account.brand === slug);
    const project = snapshot.projects.find((entry) => entry.slug === slug);
    return {
      slug,
      channels: program.channels.map((entry) => entry.channel),
      connectedChannels: accounts.filter((account) => account.ready).map((account) => account.channel).filter(Boolean).sort(),
      totalPosts: project?.stages.published ?? 0,
      lastPostedAt: snapshot.lastReceipt?.brand === slug ? snapshot.lastReceipt.recordedAt : project?.latestActivityAt ?? null
    };
  });
  return {
    ...snapshot.totals,
    schemaVersion: snapshot.schemaVersion,
    registryVersion: snapshot.registryVersion,
    generatedAt: snapshot.generatedAt,
    routedAccounts: Number(readiness.summary?.routedAccounts || 0),
    connectedAccounts: Number(readiness.summary?.connectedAccounts || 0),
    totalAccounts: Number(readiness.summary?.totalAccounts || registry.projects.reduce((sum, project) => sum + project.channels.length, 0)),
    infrastructureReady: Boolean(readiness.summary?.infrastructureReady),
    drafts: snapshot.totals.queued,
    rendering: Math.max(0, snapshot.totals.approved - snapshot.totals.produced),
    review: Math.max(0, snapshot.totals.produced - snapshot.totals.published),
    scheduled: posts.filter((post) => decodeDistributionEnvelope(post.notes)?.distributionRequest?.approval?.status === "approved" && !decodeDistributionEnvelope(post.notes)?.publicationReceipt).length,
    retrying: posts.filter((post) => decodeDistributionEnvelope(post.notes)?.attempts?.state === "retry_wait").length,
    failed: snapshot.totals.failures,
    released: snapshot.totals.published,
    measured: snapshot.totals.measured,
    projects: snapshot.projects,
    lastReceipt: snapshot.lastReceipt,
    brands
  };
}

function domainSummary() {
  const drankPath = "/Users/assistant/Desktop/fleet/drank/data/fleet-dr.json";
  let drank = {};
  try { drank = JSON.parse(readFileSync(drankPath, "utf8")); } catch {}
  const dbPath = `${process.env.HOME}/.psi-swarm/history.db`;
  const raw = existsSync(dbPath)
    ? run("sqlite3", ["-json", dbPath, "SELECT url, started_at, lcp, cls, performance_score FROM runs WHERE error IS NULL AND tag = 'fleet-weekly' ORDER BY started_at DESC LIMIT 200"], 5000)
    : "";
  let runs = [];
  try { runs = JSON.parse(raw || "[]"); } catch {}
  const median = (values) => {
    if (!values.length) return null;
    const sorted = [...values].sort((left, right) => left - right);
    return sorted[Math.floor(sorted.length / 2)] ?? null;
  };
  return Object.entries(drank.domains || {}).map(([domain, entry]) => {
    const rating = (entry.history || []).at(-1);
    const domainRuns = runs.filter((item) => {
      try { return new URL(String(item.url)).hostname.replace(/^www\./, "") === domain; } catch { return false; }
    }).slice(0, 3);
    const rawScore = median(domainRuns.map((item) => Number(item.performance_score)).filter(Number.isFinite));
    return {
      domain,
      domainRating: typeof rating?.dr === "number" ? rating.dr : null,
      domainRatingUpdatedAt: rating?.ts ? new Date(rating.ts).toISOString() : drank.lastUpdated || null,
      performanceScore: rawScore !== null && rawScore <= 1 ? rawScore * 100 : rawScore,
      lcpMs: median(domainRuns.map((item) => Number(item.lcp)).filter(Number.isFinite)),
      cls: median(domainRuns.map((item) => Number(item.cls)).filter(Number.isFinite)),
      psiUpdatedAt: domainRuns[0]?.started_at ? new Date(Number(domainRuns[0].started_at)).toISOString() : null
    };
  }).sort((left, right) => left.domain.localeCompare(right.domain));
}

function decodeDistributionEnvelope(notes) {
  const line = String(notes || "").split(/\r?\n/).find((entry) => entry.startsWith("fleet_distribution_v1:"));
  if (!line) return null;
  try { return JSON.parse(Buffer.from(line.slice("fleet_distribution_v1:".length), "base64url").toString("utf8")); }
  catch { return null; }
}

const services = [
  { id: "console", label: "Fleet dashboard", status: localHealthy() ? "running" : "stopped" },
  { id: "openclaw", label: "OpenClaw", status: launchdRunning("ai.openclaw.gateway") ? "running" : "stopped" },
  { id: "hermes", label: "Hermes", status: launchdRunning("ai.hermes.gateway") ? "running" : "stopped" },
  { id: "tailscale", label: "Private mobile access", status: tailscaleRunning() ? "running" : "needs-setup" }
];

const heartbeat = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  cadenceSeconds: 60,
  notifications: notificationSummary(),
  tasks: taskSummary(),
  marketing: marketingSummary(),
  domains: domainSummary(),
  node: {
    id: process.env.FLEET_NODE_ID || "primary-mac",
    label: process.env.FLEET_NODE_LABEL || "Primary Fleet machine",
    role: process.env.FLEET_NODE_ROLE || "Coordinator and limited workload host",
    status: services.slice(0, 3).every((service) => service.status === "running") ? "online" : "degraded",
    publicWorkloads: ["Fleet project information"],
    services
  }
};

mkdirSync(dirname(outputPath), { recursive: true });
const tempPath = `${outputPath}.${process.pid}.tmp`;
writeFileSync(tempPath, `${JSON.stringify(heartbeat, null, 2)}\n`, { mode: 0o644 });
renameSync(tempPath, outputPath);
console.log(heartbeat.generatedAt);
