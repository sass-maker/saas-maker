#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { IdeaStore } from '../src/studio/idea-store.js';
import {
  importSignificantReels,
  importedVariantToScript,
  normalizeSignificantReelsEnvelope,
} from '../src/significant-content-handoff.js';
import {
  buildMetricsReceipt,
  buildRenderReceipt,
  buildVariantPerformanceReport,
  significantContentStatus,
} from '../src/significant-content-receipts.js';

const outputDir = path.resolve(process.argv[2] ?? `./tmp/significant-content-smoke-${process.pid}`);
const fixturePath = path.resolve('./test/fixtures/significant-content-reels-v1.json');
const ideasPath = path.join(outputDir, 'ideas.json');
const now = '2026-07-13T07:00:00.000Z';

// This directory contains generated offline evidence only. No queue, provider,
// credential, scheduling, or posting path is invoked.
await mkdir(outputDir, { recursive: true });
const envelope = normalizeSignificantReelsEnvelope(JSON.parse(await readFile(fixturePath, 'utf8')));
const store = new IdeaStore({ filePath: ideasPath });
const firstImport = await importSignificantReels(envelope, { store });
const duplicateImport = await importSignificantReels(envelope, { store });
assert.equal(firstImport.imported, envelope.variants.length);
assert.equal(duplicateImport.imported, 0);

const ideas = await store.listIdeas();
const renderReceipts = [];
const metricsReceipts = [];
for (const [index, idea] of ideas.entries()) {
  const script = importedVariantToScript(idea);
  assert.equal(script.hook, idea.approvedVariant.hook);
  renderReceipts.push(buildRenderReceipt({
    ...idea.contentSource,
    provider: 'offline-fixture',
    externalId: `fixture-render-${index + 1}`,
    externalUrl: `https://assets.example.test/fixture-render-${index + 1}.mp4`,
    occurredAt: now,
    details: { simulated: true, scriptHook: script.hook },
  }));
  metricsReceipts.push(buildMetricsReceipt({
    ...idea.contentSource,
    provider: 'youtube-fixture',
    externalId: `fixture-youtube-${index + 1}`,
    externalUrl: `https://youtu.be/fixture-${index + 1}`,
    occurredAt: now,
    evidenceWindow: { start: envelope.exportedAt, end: now },
    metrics: {
      views: index === 0 ? 1500 : 700,
      watchTimeSeconds: index === 0 ? 9000 : 3500,
      retentionRate: index === 0 ? 0.66 : 0.48,
      likes: index === 0 ? 100 : 30,
      comments: index === 0 ? 12 : 4,
      shares: index === 0 ? 8 : 2,
      saves: index === 0 ? 20 : 8,
    },
  }));
}

const duplicateReceiptInput = [...renderReceipts, ...metricsReceipts, renderReceipts[0], metricsReceipts[0]];
const status = significantContentStatus({ ideas, receipts: duplicateReceiptInput });
const report = buildVariantPerformanceReport(duplicateReceiptInput, { generatedAt: now });
assert.equal(status.ok, true);
assert.equal(report.packages[0].variants.length, envelope.variants.length);

await Promise.all([
  writeJson(path.join(outputDir, 'import-first.json'), firstImport),
  writeJson(path.join(outputDir, 'import-duplicate.json'), duplicateImport),
  writeJson(path.join(outputDir, 'render-receipts.json'), { receipts: renderReceipts }),
  writeJson(path.join(outputDir, 'metrics-receipts.json'), { receipts: metricsReceipts }),
  writeJson(path.join(outputDir, 'status.json'), status),
  writeJson(path.join(outputDir, 'performance-report.json'), report),
]);

console.log(JSON.stringify({
  ok: true,
  offlineOnly: true,
  outputDir,
  validated: true,
  firstImport: firstImport.imported,
  duplicateImport: duplicateImport.imported,
  duplicateReceiptsCollapsed: true,
  leader: report.packages[0].leader,
  applyNext: 'Use the Significant Hobbies content apply-receipt command twice with the same render receipt to prove cross-repo no-op behavior.',
}, null, 2));

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
