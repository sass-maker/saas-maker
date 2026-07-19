#!/usr/bin/env node
/**
 * Foundry AI-infrastructure audit CLI.
 *
 * Runs auth-safe probes against Free AI and Knowledge Base as declared in
 * `FLEET_HEALTH_CONTRACTS`, then emits a sanitized JSON + Markdown snapshot
 * for Foundry. No provider tokens are spent and no private corpus queries
 * are issued.
 *
 * Usage:
 *   node scripts/fleet-ai-infra-audit.mjs [options]
 *
 * Options:
 *   --project free-ai|knowledge-base   Audit one project.
 *   --timeout-ms N                     Per-probe timeout (default 15000).
 *   --json                             Print JSON only.
 *   --output-dir PATH                  Write latest.json + latest.md (default
 *                                      .symphony/fleet-ai-infra-audit).
 *   --no-live                          Skip live probes; emit contract-only
 *                                      snapshot (useful in CI without network).
 *   --fail-on-failure                  Exit non-zero when any probe fails or
 *                                      the contract is invalid.
 *   --help, -h                         Show this help.
 *
 * Privacy: this script reads only route status, latency, and the declared
 * JSON payloads of `/v1/routing/status`, `/v1/budget`, and `/v1/healthz`. It
 * never reads prompts, completions, retrieved chunks, corpus content, or
 * authorization headers. Any credential-shaped substring in an error body is
 * redacted by `redactSecrets` before evidence is built.
 */
import fs from 'node:fs';
import path from 'node:path';

import {
  AI_INFRA_PROJECTS,
  buildAiInfraSnapshot,
  getAiInfraContract,
  renderAiInfraMarkdown,
} from './lib/fleet-ai-infra-audit.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DEFAULT_OUTPUT_DIR = path.join(ROOT, '.symphony', 'fleet-ai-infra-audit');

function parseArgs(argv) {
  const args = {
    project: null,
    timeoutMs: 15_000,
    jsonOnly: false,
    outputDir: DEFAULT_OUTPUT_DIR,
    noLive: false,
    failOnFailure: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--project') args.project = argv[++i] ?? null;
    else if (arg === '--timeout-ms')
      args.timeoutMs = Number.parseInt(argv[++i] ?? '', 10) || args.timeoutMs;
    else if (arg === '--json') args.jsonOnly = true;
    else if (arg === '--output-dir') args.outputDir = path.resolve(argv[++i] ?? DEFAULT_OUTPUT_DIR);
    else if (arg === '--no-live') args.noLive = true;
    else if (arg === '--fail-on-failure') args.failOnFailure = true;
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }
  return args;
}

function printHelp() {
  console.log(`Foundry AI-infrastructure audit

Usage:
  node scripts/fleet-ai-infra-audit.mjs [options]

Options:
  --project free-ai|knowledge-base   Audit one project.
  --timeout-ms N                     Per-probe timeout (default 15000).
  --json                             Print JSON only.
  --output-dir PATH                  Write latest.json + latest.md.
  --no-live                          Skip live probes; contract-only snapshot.
  --fail-on-failure                  Exit non-zero on probe failure or invalid contract.
`);
}

function selectedProjects(args) {
  const projects = AI_INFRA_PROJECTS.filter((p) => !args.project || p === args.project);
  if (args.project && projects.length === 0) {
    throw new Error(`Unknown or non-AI-infra project: ${args.project}`);
  }
  return projects;
}

async function runProbe(baseUrl, probe, timeoutMs) {
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const init = {
    method: probe.method,
    redirect: 'manual',
    signal: controller.signal,
    headers: probe.method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
    body: probe.method === 'POST' ? JSON.stringify({}) : undefined,
  };
  try {
    const response = await fetch(`${baseUrl}${probe.path}`, init);
    const body = await response.text().catch(() => '');
    return { status: response.status, durationMs: Date.now() - started, body };
  } catch (error) {
    return {
      status: null,
      durationMs: Date.now() - started,
      body: String(error instanceof Error ? error.message : error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJson(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function gatherProbeResults(projects, args) {
  if (args.noLive) return { probeResults: {}, payloads: {} };
  const probeResults = {};
  const payloads = {};
  for (const project of projects) {
    const contract = getAiInfraContract(project);
    if (!contract) continue;
    const baseUrl = contract.prodUrl?.replace(/\/$/, '') ?? null;
    // Knowledge Base's prodUrl is the dashboard; the Worker health lives on
    // the workers.dev URL. Use the smokeCommand's URL as the probe base.
    let probeBase = baseUrl;
    if (project === 'knowledge-base') {
      probeBase = 'https://knowledgebase.sarthakagrawal927.workers.dev';
    }
    if (!probeBase) continue;

    for (const probe of contract.automation.authSafeProbes) {
      probeResults[`${project}:${probe.label}`] = await runProbe(probeBase, probe, args.timeoutMs);
    }
    const protectedProbe = contract.automation.protectedProbe;
    probeResults[`${project}:${protectedProbe.label}`] = await runProbe(
      probeBase,
      protectedProbe,
      args.timeoutMs
    );

    // Higher-fidelity payloads for sanitized evidence.
    if (project === 'free-ai') {
      payloads[`${project}:routing-status`] = await fetchJson(
        `${probeBase}/v1/routing/status`,
        args.timeoutMs
      );
      payloads[`${project}:budget`] = await fetchJson(`${probeBase}/v1/budget`, args.timeoutMs);
    }
    if (project === 'knowledge-base') {
      payloads[`${project}:health`] = await fetchJson(`${probeBase}/v1/healthz`, args.timeoutMs);
    }
  }
  return { probeResults, payloads };
}

function writeReports(args, snapshot) {
  fs.mkdirSync(args.outputDir, { recursive: true });
  fs.writeFileSync(
    path.join(args.outputDir, 'latest.json'),
    `${JSON.stringify(snapshot, null, 2)}\n`
  );
  fs.writeFileSync(path.join(args.outputDir, 'latest.md'), renderAiInfraMarkdown(snapshot));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const projects = selectedProjects(args);
  // Always validate contracts for all AI-infra projects, even when --project
  // is set, so a partial run still surfaces contract drift in the other
  // project. Live probes are scoped to the selected project(s).
  const { probeResults, payloads } = await gatherProbeResults(projects, args);
  const snapshot = buildAiInfraSnapshot(probeResults, payloads, { includeBody: true });

  writeReports(args, snapshot);

  if (args.jsonOnly) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    for (const project of snapshot.projects) {
      const failed = [
        ...project.evidence,
        ...(project.protectedEvidence ? [project.protectedEvidence] : []),
      ].filter((e) => !e.ok);
      console.log(
        `${failed.length === 0 ? 'PASS' : 'FAIL'} ${project.project}: ${project.evidence.length + (project.protectedEvidence ? 1 : 0) - failed.length}/${project.evidence.length + (project.protectedEvidence ? 1 : 0)} probes passed`
      );
    }
    console.log(`\nReport: ${path.join(args.outputDir, 'latest.md')}`);
  }

  const failed = snapshot.summary.failedProbes > 0 || !snapshot.contractOk;
  if (failed && args.failOnFailure) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
