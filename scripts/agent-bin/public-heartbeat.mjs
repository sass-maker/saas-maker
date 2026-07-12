#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
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
const tempPath = `${outputPath}.tmp`;
writeFileSync(tempPath, `${JSON.stringify(heartbeat, null, 2)}\n`, { mode: 0o644 });
renameSync(tempPath, outputPath);
console.log(heartbeat.generatedAt);
