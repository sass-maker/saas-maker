#!/usr/bin/env node
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { IdeaStore } from '../src/studio/idea-store.js';
import {
  importSignificantReels,
  normalizeSignificantReelsEnvelope,
} from '../src/significant-content-handoff.js';
import {
  buildFollowUpBrief,
  buildSignificantContentReceipt,
  buildVariantPerformanceReport,
  significantContentStatus,
} from '../src/significant-content-receipts.js';

const [command = 'help', ...argv] = process.argv.slice(2);
const flags = parseFlags(argv);

try {
  const result = await run(command, flags);
  if (result !== undefined) console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exitCode = 1;
}

async function run(selected, options) {
  if (selected === 'help' || options.help) {
    console.log(usage());
    return undefined;
  }
  const store = new IdeaStore({ filePath: options.store });
  if (selected === 'validate') {
    const envelope = normalizeSignificantReelsEnvelope(await readJson(required(options.input, '--input')));
    return { valid: true, schema: envelope.schema, packageId: envelope.packageId, packageRevision: envelope.packageRevision, variants: envelope.variants.length };
  }
  if (selected === 'import') {
    const result = await importSignificantReels(await readJson(required(options.input, '--input')), { store });
    return output(result, options.out);
  }
  if (selected === 'status') {
    const receipts = options.receipts ? await readReceipts(options.receipts) : [];
    const result = significantContentStatus({
      ideas: await store.listIdeas(),
      receipts,
      packageId: value(options['package-id']),
      packageRevision: value(options.revision),
    });
    return output(result, options.out);
  }
  if (selected === 'receipt') {
    const input = await readJson(required(options.input, '--input'));
    const result = buildSignificantContentReceipt({ ...input, stage: value(options.stage) ?? input.stage });
    return output(result, required(options.out, '--out'));
  }
  if (selected === 'report') {
    const receipts = await readReceipts(required(options.receipts, '--receipts'));
    const result = buildVariantPerformanceReport(receipts, { generatedAt: value(options['generated-at']) });
    return output(result, options.out);
  }
  if (selected === 'follow-up') {
    const report = await readJson(required(options.report, '--report'));
    const result = buildFollowUpBrief({
      report,
      ideas: await store.listIdeas(),
      packageId: requiredValue(options['package-id'], '--package-id'),
      packageRevision: requiredValue(options.revision, '--revision'),
      generatedAt: value(options['generated-at']),
    });
    return output(result, required(options.out, '--out'));
  }
  throw new Error(`unknown command: ${selected}`);
}

async function output(valueToWrite, target) {
  if (target && target !== true) await atomicWriteJson(path.resolve(target), valueToWrite);
  return valueToWrite;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(path.resolve(filePath), 'utf8'));
}

async function readReceipts(filePath) {
  const valueToRead = await readJson(filePath);
  if (Array.isArray(valueToRead)) return valueToRead;
  if (Array.isArray(valueToRead.receipts)) return valueToRead.receipts;
  return [valueToRead];
}

async function atomicWriteJson(filePath, data) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`);
  await rename(temporary, filePath);
}

function parseFlags(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith('--')) parsed[key] = true;
    else { parsed[key] = next; index += 1; }
  }
  return parsed;
}

function required(input, flag) {
  const result = requiredValue(input, flag);
  return path.resolve(result);
}
function requiredValue(input, flag) {
  if (!input || input === true) throw new Error(`${flag} is required`);
  return input;
}
function value(input) {
  return input && input !== true ? input : undefined;
}
function usage() {
  return `Usage: npm run significant-content -- <command> [flags]

Commands:
  validate  --input envelope.json
  import    --input envelope.json [--store ideas.json] [--out result.json]
  status    [--store ideas.json] [--receipts receipts.json] [--package-id ID] [--revision N] [--out status.json]
  receipt   --stage render|upload|metrics --input receipt-fields.json --out receipt.json
  report    --receipts receipts.json [--generated-at ISO] [--out report.json]
  follow-up --report report.json --package-id ID --revision N [--store ideas.json] --out draft.json

All commands are local and deterministic. They do not approve, accept, schedule,
upload, post, fetch credentials, or change Significant Hobbies source files.`;
}
