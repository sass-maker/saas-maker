#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { entryById, loadAutomationRegistry, validateAutomationRegistry } from "../lib/fleet-automation/registry.mjs";
import { evaluateAction } from "../lib/fleet-automation/policy.mjs";
import { sanitizeEvidence } from "../lib/fleet-automation/evidence.mjs";

const args = process.argv.slice(2);
function option(name, fallback = null) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
}

const projectId = option("--project");
const action = option("--action");
const approved = args.includes("--approved");
const approvalReference = option("--approval-reference");
const findingReference = option("--finding-reference");
const verification = option("--verification", "pending");
const resultReference = option("--result-reference");
const writeReceipt = args.includes("--write-receipt");
const stateDir = resolve(option("--state-dir", process.env.FLEET_AUTOMATION_STATE_DIR || resolve(homedir(), "Library/Application Support/Fleet Ops/automation-actions")));

if (!projectId || !action) {
  console.error("usage: fleet-automation-action --project <id> --action <type> [--approved --approval-reference <ref>] [--write-receipt]");
  process.exit(2);
}

const registry = loadAutomationRegistry();
const validation = validateAutomationRegistry(registry);
if (validation.errors.length) throw new Error(validation.errors.join("\n"));
const entry = entryById(registry, projectId);
const decision = evaluateAction({ entry, action, approved, approvalReference });
const receipt = sanitizeEvidence({
  schemaVersion: 1,
  id: randomUUID(),
  createdAt: new Date().toISOString(),
  projectId,
  attention: entry?.attention || null,
  action,
  findingReference,
  approval: { approved, reference: approvalReference },
  decision,
  verification: { status: verification, reference: resultReference }
});

if (writeReceipt) {
  mkdirSync(resolve(stateDir, "receipts"), { recursive: true, mode: 0o700 });
  const path = resolve(stateDir, "receipts", `${receipt.id}.json`);
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, path);
  receipt.receiptPath = path;
}

console.log(JSON.stringify(receipt, null, 2));
process.exitCode = decision.authorized ? 0 : 3;
