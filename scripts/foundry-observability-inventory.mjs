#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_LIMITS,
  renderFoundryObservabilityMarkdown,
  scanFoundryObservability,
} from './foundry-observability-core.mjs';

export function parseArgs(argv) {
  const args = {
    root: '.',
    output: null,
    markdownOutput: null,
    format: 'markdown',
    freshnessHours: 168,
    now: undefined,
    failOnFindings: false,
    limits: { ...DEFAULT_LIMITS },
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      const value = argv[++index];
      if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value`);
      return value;
    };
    if (arg === '--root') args.root = next();
    else if (arg === '--output') args.output = next();
    else if (arg === '--markdown-output') args.markdownOutput = next();
    else if (arg === '--format') args.format = next();
    else if (arg === '--json') args.format = 'json';
    else if (arg === '--markdown') args.format = 'markdown';
    else if (arg === '--freshness-hours') args.freshnessHours = Number(next());
    else if (arg === '--now') args.now = next();
    else if (arg === '--max-files') args.limits.maxFilesPerProject = Number(next());
    else if (arg === '--max-file-bytes') args.limits.maxFileBytes = Number(next());
    else if (arg === '--max-total-bytes') args.limits.maxTotalBytesPerProject = Number(next());
    else if (arg === '--fail-on-findings') args.failOnFindings = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!['json', 'markdown'].includes(args.format)) throw new Error('--format must be json or markdown');
  return args;
}

function usage() {
  return `Foundry provider-neutral observability inventory

Usage:
  node scripts/foundry-observability-inventory.mjs --root .
  node scripts/foundry-observability-inventory.mjs --root . --output /tmp/foundry-observability.json
  node scripts/foundry-observability-inventory.mjs --root . --format json
  node scripts/foundry-observability-inventory.mjs --root . --markdown-output /tmp/foundry-observability.md

Options:
  --output <path>            Write sanitized JSON.
  --markdown-output <path>   Write sanitized Markdown.
  --format <json|markdown>   Select stdout format (default: markdown).
  --freshness-hours <hours>  Verification receipt freshness target (default: 168).
  --max-files <count>        Per-project source file cap (default: ${DEFAULT_LIMITS.maxFilesPerProject}).
  --max-file-bytes <bytes>   Skip files larger than this cap (default: ${DEFAULT_LIMITS.maxFileBytes}).
  --max-total-bytes <bytes>  Per-project total read cap (default: ${DEFAULT_LIMITS.maxTotalBytesPerProject}).
  --fail-on-findings         Exit 1 when any finding is present.
`;
}

function writeReport(file, content) {
  const resolved = path.resolve(file);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, content.endsWith('\n') ? content : `${content}\n`, 'utf8');
}

export function run(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }
  const report = scanFoundryObservability({
    root: args.root,
    now: args.now,
    freshnessHours: args.freshnessHours,
    limits: args.limits,
  });
  const json = JSON.stringify(report, null, 2);
  const markdown = renderFoundryObservabilityMarkdown(report);
  if (args.output) writeReport(args.output, json);
  if (args.markdownOutput) writeReport(args.markdownOutput, markdown);
  process.stdout.write(`${args.format === 'json' ? json : markdown}\n`);
  return args.failOnFindings && report.findings.length > 0 ? 1 : 0;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    process.exitCode = run();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  }
}
