#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

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
  const cli = "/Users/assistant/Desktop/fleet/saas-maker/packages/cli/dist/index.js";
  const raw = existsSync(cli)
    ? run(process.execPath, [cli, "api", "GET", "/v1/marketing/posts", "--auth", "session", "--query", "limit=500", "--raw", "--quiet"], 15000)
    : "";
  let posts = [];
  try {
    const start = raw.indexOf("{");
    posts = (JSON.parse(start >= 0 ? raw.slice(start) : raw).data || []).filter((post) => String(post.notes || "").includes("fleet_distribution_v1:"));
  } catch {}
  const envelopes = posts.map((post) => ({ post, envelope: decodeDistributionEnvelope(post.notes) })).filter((entry) => entry.envelope);
  const brandSlugs = [...new Set([
    ...(readiness.accounts || []).map((account) => account.brand),
    ...envelopes.map(({ post, envelope }) => envelope.contentPackage?.brand?.slug || post.project_slug)
  ].filter(Boolean))].sort();
  const brands = brandSlugs.map((slug) => {
    const accounts = (readiness.accounts || []).filter((account) => account.brand === slug);
    const brandPosts = envelopes.filter(({ post, envelope }) => (envelope.contentPackage?.brand?.slug || post.project_slug) === slug);
    const published = brandPosts.filter(({ post, envelope }) => post.status === "sent" || Boolean(envelope.publicationReceipt));
    const lastPostedAt = published
      .map(({ post, envelope }) => envelope.publicationReceipt?.recordedAt || envelope.publicationReceipt?.postedAt || post.posted_at)
      .filter(Boolean)
      .sort()
      .at(-1) || null;
    return {
      slug,
      channels: accounts.map((account) => account.channel).filter(Boolean).sort(),
      connectedChannels: accounts.filter((account) => account.ready).map((account) => account.channel).filter(Boolean).sort(),
      totalPosts: published.length,
      lastPostedAt
    };
  });
  return {
    generatedAt: readiness.generatedAt || null,
    routedAccounts: Number(readiness.summary?.routedAccounts || 0),
    connectedAccounts: Number(readiness.summary?.connectedAccounts || 0),
    totalAccounts: Number(readiness.summary?.totalAccounts || 6),
    infrastructureReady: Boolean(readiness.summary?.infrastructureReady),
    drafts: envelopes.filter(({ post }) => post.status === "generated").length,
    rendering: envelopes.filter(({ post, envelope }) => post.status === "accepted" && !envelope.mediaReceipt).length,
    review: envelopes.filter(({ envelope }) => envelope.mediaReceipt && envelope.distributionRequest?.approval?.status === "proposed").length,
    scheduled: envelopes.filter(({ envelope }) => envelope.distributionRequest?.approval?.status === "approved" && !envelope.publicationReceipt).length,
    retrying: envelopes.filter(({ envelope }) => envelope.attempts?.state === "retry_wait").length,
    failed: envelopes.filter(({ envelope }) => envelope.attempts?.state === "failed").length,
    released: envelopes.filter(({ post, envelope }) => post.status === "sent" || Boolean(envelope.publicationReceipt)).length,
    brands
  };
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
