import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { validateDesignPreflight, validateDesignReview, validateDesignReviewEvidence, validateDesignWorkflowPolicy } from '../lib/design-workflow.mjs';
import { mergeDesignRoutingHook } from '../scripts/install-skill-run-hook.mjs';

const root = resolve(import.meta.dirname, '..');
const policy = JSON.parse(readFileSync(resolve(root, 'config/design-workflow.json'), 'utf8'));
const template = JSON.parse(readFileSync(resolve(root, 'templates/design-review.json'), 'utf8'));

// Synthetic runner reports test receipt validation, not real visual quality.
function scoredSlopReport(score = 40) {
  return {
    tool: { name: 'slop-detect', revision: 'cdd58e1d249ae39616d94950d6ea232ec7b0b378' },
    measuredAt: '2026-10-02T00:00:00.000Z',
    viewport: { width: 1280, height: 800 },
    posture: 'advisory', status: 'scanned',
    results: [{ score, definitionsVersion: 'fixture-v1', preset: 'full', patternsErrored: 0, patterns: [] }],
  };
}

function slopCheckpoint(stage, direction) {
  return {
    stage, ...(direction ? { direction } : {}), status: 'scanned',
    command: 'node tooling/scripts/slop-score.mjs http://127.0.0.1:3000 --json',
    report: `.fleet-local/slop/${stage}${direction ? `-${direction}` : ''}.json`,
    findingsReview: 'Synthetic fixture: no claim that a product was scanned or reviewed.',
  };
}

function completePersuadeReceipt() {
  const receipt = structuredClone(template);
  receipt.project = 'example';
  receipt.target = 'landing page';
  receipt.surfaceMode = 'persuade';
  receipt.direction.contract = {
    purpose: 'Explain the product clearly to the intended visitor.',
    purposeSource: 'SaaS Maker purpose contract plus PRODUCT.md',
    canonicalPurpose: 'Example helps a specific user complete a specific job.',
    purposeAlignment: 'match',
    driftNote: '',
    audience: 'A specific intended user.',
    job: 'Understand the product and choose the honest next action.',
    thesis: 'A product-specific visual thesis.',
    system: 'A role-based visual system.',
    signature: 'A memorable product-specific element.',
    risk: 'One deliberate and bounded visual risk.',
    qualityBar: 'Clear typographic hierarchy and product-specific composition across screen sizes.',
  };
  receipt.direction.library.primary = 'tailwind-plus';
  receipt.direction.library.sources.push('https://tailwindcss.com/plus/ui-blocks/marketing/sections/footers');
  receipt.direction.library.runtime = 'markup-only';
  receipt.direction.productSurfaces = {
    scope: 'standalone', landing: 'Synthetic landing fixture', app: '',
    reason: 'Validation fixture has no separate application surface.',
  };
  receipt.evidence.productContinuity = {
    status: 'not-applicable', reason: receipt.direction.productSurfaces.reason,
  };
  receipt.evidence.projectCheck = { command: 'pnpm test', status: 'pass' };
  receipt.evidence.slopScale.checkpoints = [slopCheckpoint('iteration'), slopCheckpoint('final')];
  receipt.evidence.critique.score = 32;
  receipt.evidence.critique.dimensions = { hierarchy: 6, typography: 6, composition: 6, identity: 6, interaction: 4, responsive: 4 };
  receipt.evidence.audit.score = 16;
  receipt.evidence.audit.dimensions = { purpose: 4, accessibility: 4, behavior: 4, responsive: 2, performance: 2 };
  receipt.evidence.visualReview = {
    status: 'pass',
    reviewer: 'implementing agent; direct rendered review',
    direction: receipt.direction.selected,
    report: 'artifacts/design/review.md',
    checks: Object.fromEntries(['hierarchy', 'typography', 'composition', 'identity', 'interaction', 'responsive']
      .map((dimension) => [dimension, { status: 'pass', observation: `Reviewed ${dimension} against the direction and captured the result.` }])),
  };
  receipt.evidence.comprehension = {
    status: 'pass',
    reviewer: 'independent reviewer',
    answers: {
      product: 'Example product',
      audience: 'A specific intended user',
      value: 'A specific useful outcome',
      mechanism: 'A distinct product mechanism',
      proof: 'A working product artifact',
      nextAction: 'Open the product',
    },
    purposeScore: {
      product: 25,
      audience: 15,
      value: 15,
      mechanism: 15,
      proof: 15,
      nextAction: 15,
      total: 100,
    },
    mismatches: [],
  };
  return receipt;
}

test('a persuade receipt passes when canonical purpose and fresh-visitor answers agree', () => {
  assert.doesNotThrow(() =>
    validateDesignReview(completePersuadeReceipt(), policy, {
      projectRoot: root,
      pathExists: () => true, readReport: () => scoredSlopReport(),
    }),
  );
});

function completeOverhaulReceipt(count = 3) {
  const receipt = completePersuadeReceipt();
  receipt.mode = 'overhaul';
  receipt.direction.source = 'comparison';
  receipt.direction.probes = Array.from({ length: count }, (_, i) => ({
    id: `direction-${i}`,
    path: `artifacts/design/direction-${i}.svg`,
    thesis: `Product-native direction ${i}`,
    layout: `Distinct composition ${i}`,
    typography: `Distinct hierarchy ${i}`,
  }));
  receipt.direction.selected = 'direction-0';
  receipt.direction.approval = 'approved';
  receipt.direction.ownerEvidence = { path: 'artifacts/design/owner-decision.md', quote: 'Use direction 0.' };
  receipt.ownerFeedback = { decision: 'keep', note: 'Owner selected direction 0; final result acceptance is separate.' };
  receipt.evidence.visualReview.direction = 'direction-0';
  receipt.evidence.slopScale.checkpoints.push(...receipt.direction.probes.map(({ id }) => slopCheckpoint('directions', id)));
  return receipt;
}

function completePairedReceipt(count = 3) {
  const receipt = completeOverhaulReceipt(count);
  receipt.direction.productSurfaces = { scope: 'paired', landing: 'https://example.test/', app: 'https://example.test/app', reason: '' };
  for (const probe of receipt.direction.probes) {
    probe.surfaces = { landing: `artifacts/design/${probe.id}-landing.png`, app: `artifacts/design/${probe.id}-app.png` };
  }
  receipt.direction.pairedPreview = { landing: 'artifacts/design/supplied-landing.png', app: 'artifacts/design/supplied-app.png' };
  if (count === 0) receipt.evidence.slopScale.checkpoints.push(slopCheckpoint('directions', receipt.direction.selected));
  receipt.evidence.productContinuity = {
    status: 'pass', reviewer: 'Synthetic validation fixture; no product review claim',
    report: 'artifacts/design/product-continuity.md',
    surfaces: { landing: 'artifacts/design/landing.png', app: 'artifacts/design/app.png' },
    checks: Object.fromEntries(['designSystem', 'identity', 'vocabulary', 'productTruth', 'handoff']
      .map((field) => [field, { status: 'pass', observation: `Synthetic ${field} observation across both surfaces.` }])),
  };
  return receipt;
}

test('comparison preflight accepts three or four directions and rejects zero, two, and five', () => {
  for (const count of [3, 4]) {
    assert.doesNotThrow(() => validateDesignPreflight(completeOverhaulReceipt(count), policy, { projectRoot: root, pathExists: () => true, readReport: () => scoredSlopReport() }));
  }
  for (const count of [0, 2, 5]) {
    assert.throws(() => validateDesignPreflight(completeOverhaulReceipt(count), policy, { projectRoot: root, pathExists: () => true, readReport: () => scoredSlopReport() }), /3-4 direction probes/);
  }
});

test('an agent cannot approve an overhaul or substitute an unauthenticated decision', () => {
  const receipt = completeOverhaulReceipt();
  receipt.direction.approval = 'agent-selected';
  assert.throws(() => validateDesignPreflight(receipt, policy, { projectRoot: root, pathExists: () => true, readReport: () => scoredSlopReport() }), /approval must be approved/);
  receipt.direction.approval = 'approved';
  receipt.direction.ownerEvidence.quote = '';
  assert.throws(() => validateDesignPreflight(receipt, policy, { projectRoot: root, pathExists: () => true, readReport: () => scoredSlopReport() }), /exact owner selection/);
});

test('different ids cannot disguise a reused visual probe', () => {
  const receipt = completeOverhaulReceipt();
  receipt.direction.probes[1].path = receipt.direction.probes[0].path;
  assert.throws(() => validateDesignPreflight(receipt, policy, { projectRoot: root, pathExists: () => true, readReport: () => scoredSlopReport() }), /distinct visual artifacts/);
});

test('explicit delegation and a supplied direction have evidenced exception paths', () => {
  for (const source of ['delegated', 'owner-supplied']) {
    const receipt = completeOverhaulReceipt(0);
    receipt.direction.source = source;
    receipt.direction.selected = 'supplied-system';
    receipt.direction.approval = source === 'delegated' ? 'delegated' : 'approved';
    receipt.direction.supplied = 'artifacts/design/supplied-system.svg';
    receipt.direction.ownerEvidence.quote = source === 'delegated' ? 'I explicitly delegate the visual direction choice to you.' : 'Use my supplied system.';
    receipt.evidence.slopScale.checkpoints.push(slopCheckpoint('directions', 'supplied-system'));
    assert.doesNotThrow(() => validateDesignPreflight(receipt, policy, { projectRoot: root, pathExists: () => true, readReport: () => scoredSlopReport() }));
    receipt.direction.ownerEvidence.path = '';
    assert.throws(() => validateDesignPreflight(receipt, policy, { projectRoot: root, pathExists: () => true, readReport: () => scoredSlopReport() }), /ownerEvidence path is required/);
  }
});

test('a preflight can pass while completion correctly waits on rendered review and project checks', () => {
  const receipt = completeOverhaulReceipt();
  receipt.evidence = { slopScale: receipt.evidence.slopScale };
  assert.doesNotThrow(() => validateDesignPreflight(receipt, policy, { projectRoot: root, pathExists: () => true, readReport: () => scoredSlopReport() }));
  assert.throws(() => validateDesignReview(receipt, policy, { projectRoot: root, pathExists: () => true, readReport: () => scoredSlopReport() }), /passing rendered visual review/);
});

test('a high-scoring UI fails if craft review is missing, fails, or targets an older direction', () => {
  for (const mutate of [
    (r) => { delete r.evidence.visualReview; },
    (r) => { r.evidence.visualReview.checks.identity.status = 'fail'; },
    (r) => { r.evidence.visualReview.direction = 'old-direction'; },
  ]) {
    const receipt = completeOverhaulReceipt();
    receipt.evidence.critique.score = 40;
    receipt.evidence.audit.score = 20;
    mutate(receipt);
    assert.throws(() => validateDesignReview(receipt, policy, { projectRoot: root, pathExists: () => true, readReport: () => scoredSlopReport() }), /visual review/);
  }
});

test('not-required owner feedback cannot bypass an overhaul decision', () => {
  const receipt = completeOverhaulReceipt();
  receipt.ownerFeedback.decision = 'not-required';
  assert.throws(() => validateDesignReview(receipt, policy, { projectRoot: root, pathExists: () => true, readReport: () => scoredSlopReport() }), /match the evidenced direction decision/);
});

test('negative unresolved counts and legacy receipts cannot qualify a fresh review', () => {
  const receipt = completePersuadeReceipt();
  receipt.evidence.unresolved.p1 = -1;
  assert.throws(() => validateDesignReview(receipt, policy, { projectRoot: root, pathExists: () => true, readReport: () => scoredSlopReport() }), /unresolved P1/);
  receipt.$schema = 'fleet.design-review.v1';
  receipt.version = 1;
  assert.throws(() => validateDesignPreflight(receipt, policy, { projectRoot: root, pathExists: () => true, readReport: () => scoredSlopReport() }), /renew legacy receipts/);
});

test('policy validation cannot silently weaken the owner-selection rule', () => {
  const weak = structuredClone(policy);
  weak.lanes.overhaul.minimumDirectionProbes = 0;
  weak.lanes.overhaul.acceptedDirectionDecisions.push('agent-selected');
  assert.throws(() => validateDesignWorkflowPolicy(weak), /three or four direction probes/);
});

test('a claimed passing total requires matching rubric dimensions', () => {
  const receipt = completePersuadeReceipt();
  receipt.evidence.critique.score = 40;
  assert.throws(() => validateDesignReview(receipt, policy, { projectRoot: root, pathExists: () => true, readReport: () => scoredSlopReport() }), /score must equal its dimension total/);
  receipt.evidence.critique.score = 32;
  delete receipt.evidence.audit.dimensions;
  assert.throws(() => validateDesignReview(receipt, policy, { projectRoot: root, pathExists: () => true, readReport: () => scoredSlopReport() }), /requires dimension scores/);
});

test('every overhaul direction needs its slop checkpoint before implementation', () => {
  const receipt = completeOverhaulReceipt();
  receipt.evidence.slopScale.checkpoints = receipt.evidence.slopScale.checkpoints
    .filter(({ direction }) => direction !== 'direction-1');
  assert.throws(() => validateDesignPreflight(receipt, policy, {
    projectRoot: root, pathExists: () => true, readReport: () => scoredSlopReport(),
  }), /directions \(direction-1\) requires exactly one checkpoint/);
});

test('completion cannot skip the iteration scan even with a final scan and passing craft scores', () => {
  for (const missing of ['iteration', 'final']) {
    const receipt = completePersuadeReceipt();
    receipt.evidence.slopScale.checkpoints = receipt.evidence.slopScale.checkpoints
      .filter(({ stage }) => stage !== missing);
    assert.throws(() => validateDesignReview(receipt, policy, {
      projectRoot: root, pathExists: () => true, readReport: () => scoredSlopReport(),
    }), new RegExp(`slopScale ${missing} requires exactly one checkpoint`));
  }
  const receipt = completePersuadeReceipt();
  delete receipt.evidence.slopScale;
  assert.throws(() => validateDesignReview(receipt, policy, {
    projectRoot: root, pathExists: () => true,
  }), /evidence.slopScale/);
});

test('Heavy scores remain advisory while finding review and a separate final report are required', () => {
  const receipt = completePersuadeReceipt();
  const options = { projectRoot: root, pathExists: () => true, readReport: () => scoredSlopReport(100) };
  assert.deepEqual(validateDesignReview(receipt, policy, options).slopScale[0].scores, [100]);
  receipt.evidence.slopScale.checkpoints[0].findingsReview = '';
  assert.throws(() => validateDesignReview(receipt, policy, options), /finding dispositions/);
  receipt.evidence.slopScale.checkpoints[0].findingsReview = 'Intentional fixture decision.';
  receipt.evidence.slopScale.checkpoints[1].report = receipt.evidence.slopScale.checkpoints[0].report;
  assert.throws(() => validateDesignReview(receipt, policy, options), /own checkpoint report/);
});

test('blocked scans stay unknown and require a concrete limitation instead of a Clean score', () => {
  const receipt = completePersuadeReceipt();
  const checkpoint = receipt.evidence.slopScale.checkpoints[0];
  checkpoint.status = 'blocked';
  checkpoint.reason = 'Fixture extractor failed; error output retained in the report.';
  const options = { projectRoot: root, pathExists: () => true, readReport: () => scoredSlopReport() };
  assert.equal(validateDesignReview(receipt, policy, options).slopScale[0].status, 'unknown');
  checkpoint.score = 0;
  assert.throws(() => validateDesignReview(receipt, policy, options), /unknown score, never Clean/);
  delete checkpoint.score;
  checkpoint.reason = '';
  assert.throws(() => validateDesignReview(receipt, policy, options), /concrete error or capability limitation/);
});

test('failed or provenance-free runner output cannot qualify as a successful scan', () => {
  for (const mutate of [
    (report) => { report.status = 'scan-failed'; report.results[0].score = 0; },
    (report) => { report.results[0].blocked = true; },
    (report) => { report.results[0].patternsErrored = 1; },
    (report) => { delete report.tool.revision; },
    (report) => { delete report.results[0].definitionsVersion; },
  ]) {
    const report = scoredSlopReport();
    mutate(report);
    assert.throws(() => validateDesignReview(completePersuadeReceipt(), policy, {
      projectRoot: root, pathExists: () => true, readReport: () => report,
    }), /successful runner JSON report/);
  }
});

test('native surfaces have an explained web-scanner exemption without invented scores', () => {
  const receipt = completeOverhaulReceipt();
  receipt.evidence.slopScale = {
    platform: 'native', posture: 'advisory', checkpoints: [],
    reason: 'Native AppKit surface; the Chromium web scanner does not inspect this renderer.',
  };
  const options = { projectRoot: root, pathExists: () => true, readReport: () => { throw new Error('Must not run'); } };
  assert.equal(validateDesignReview(receipt, policy, options).slopScale[0].status, 'not-applicable');
  receipt.evidence.slopScale.reason = '';
  assert.throws(() => validateDesignPreflight(receipt, policy, options), /native slopScale exemption requires a reason/);
});

test('policy cannot silently remove the slop scale checkpoints', () => {
  const weak = structuredClone(policy);
  weak.qualityGate.slopScale.requiredWebCheckpoints = ['final'];
  assert.throws(() => validateDesignWorkflowPolicy(weak), /directions, iteration, and final checkpoints/);
});

test('surface inventory cannot omit the counterpart or silently opt out of continuity review', () => {
  const options = { projectRoot: root, pathExists: () => true, readReport: () => scoredSlopReport() };
  const receipt = completePersuadeReceipt();
  receipt.direction.productSurfaces.scope = 'pending';
  assert.throws(() => validateDesignPreflight(receipt, policy, options), /scope must inventory/);
  receipt.direction.productSurfaces.scope = 'standalone';
  receipt.direction.productSurfaces.reason = '';
  assert.throws(() => validateDesignPreflight(receipt, policy, options), /why there is no landing\/app counterpart/);
  receipt.direction.productSurfaces.reason = 'Synthetic fixture';
  receipt.direction.productSurfaces.app = 'https://example.test/app';
  assert.throws(() => validateDesignPreflight(receipt, policy, options), /both landing and app surfaces must use paired scope/);
});

test('overhaul selection requires paired previews for every comparison direction', () => {
  const options = { projectRoot: root, pathExists: () => true, readReport: () => scoredSlopReport() };
  const receipt = completePairedReceipt();
  assert.doesNotThrow(() => validateDesignPreflight(receipt, policy, options));
  delete receipt.direction.probes[1].surfaces.app;
  assert.throws(() => validateDesignPreflight(receipt, policy, options), /direction-1.surfaces.app path is required/);
});

test('supplied and delegated direction exceptions still require a landing and app preview', () => {
  const options = { projectRoot: root, pathExists: () => true, readReport: () => scoredSlopReport() };
  for (const source of ['owner-supplied', 'delegated']) {
    const receipt = completePairedReceipt(0);
    receipt.direction.source = source;
    receipt.direction.supplied = 'artifacts/design/supplied.svg';
    receipt.direction.approval = source === 'delegated' ? 'delegated' : 'approved';
    assert.doesNotThrow(() => validateDesignPreflight(receipt, policy, options));
    receipt.direction.pairedPreview.app = '';
    assert.throws(() => validateDesignPreflight(receipt, policy, options), /direction.pairedPreview.app path is required/);
  }
});

test('perfect individual scores cannot hide a landing/app mismatch or unverified handoff', () => {
  const options = { projectRoot: root, pathExists: () => true, readReport: () => scoredSlopReport() };
  for (const mutate of [
    (receipt) => { delete receipt.evidence.productContinuity; },
    (receipt) => { receipt.evidence.productContinuity.checks.designSystem.status = 'fail'; },
    (receipt) => { receipt.evidence.productContinuity.checks.productTruth.status = 'fail'; },
    (receipt) => { receipt.evidence.productContinuity.checks.handoff.status = 'blocked'; },
  ]) {
    const receipt = completePairedReceipt();
    receipt.evidence.critique.score = 40;
    receipt.evidence.critique.dimensions = structuredClone(policy.qualityGate.critiqueWeights);
    receipt.evidence.audit.score = 20;
    receipt.evidence.audit.dimensions = structuredClone(policy.qualityGate.auditWeights);
    mutate(receipt);
    assert.throws(() => validateDesignReview(receipt, policy, options), /continuity/);
  }
});

test('paired continuity preserves shared identity while allowing explained task-specific density', () => {
  const options = { projectRoot: root, pathExists: () => true, readReport: () => scoredSlopReport() };
  const receipt = completePairedReceipt();
  receipt.evidence.productContinuity.checks.designSystem.observation = 'Same product tokens and hierarchy; the app uses denser task rows than the explanatory landing.';
  assert.equal(validateDesignReview(receipt, policy, options).productContinuity, 'pass');
  receipt.evidence.productContinuity.surfaces.app = receipt.evidence.productContinuity.surfaces.landing;
  assert.throws(() => validateDesignReview(receipt, policy, options), /distinct landing and app evidence/);
});

test('continuity is a separate required policy gate', () => {
  const weak = structuredClone(policy);
  weak.qualityGate.requireProductContinuity = false;
  assert.throws(() => validateDesignWorkflowPolicy(weak), /landing-to-app product continuity/);
});

test('real preflight evidence must be a nonempty file, not an empty placeholder or directory', () => {
  const projectRoot = mkdtempSync(resolve(tmpdir(), 'design-preflight-'));
  writeFileSync(resolve(projectRoot, 'PRODUCT.md'), 'Product context');
  writeFileSync(resolve(projectRoot, 'DESIGN.md'), 'Design context');
  mkdirSync(resolve(projectRoot, 'artifacts/design'), { recursive: true });
  const receipt = completePersuadeReceipt();
  const before = resolve(projectRoot, receipt.direction.before);
  writeFileSync(before, '');
  assert.throws(() => validateDesignPreflight(receipt, policy, { projectRoot }), /direction.before does not exist/);
  receipt.direction.before = 'artifacts/design';
  assert.throws(() => validateDesignPreflight(receipt, policy, { projectRoot }), /direction.before does not exist/);
  receipt.direction.before = 'artifacts/design/before.png';
  writeFileSync(before, 'Fixture evidence; not a real rendered screenshot.');
  assert.doesNotThrow(() => validateDesignPreflight(receipt, policy, { projectRoot }));
});

test('CLI preserves historical receipts and separates preflight from completion', () => {
  const projectRoot = mkdtempSync(resolve(tmpdir(), 'design-cli-'));
  writeFileSync(resolve(projectRoot, 'PRODUCT.md'), 'Product context');
  writeFileSync(resolve(projectRoot, 'DESIGN.md'), 'Design context');
  mkdirSync(resolve(projectRoot, '.fleet'));
  writeFileSync(resolve(projectRoot, '.fleet/design-review.json'), 'historical receipt');
  const cli = resolve(root, 'scripts/design-workflow.mjs');
  const run = (args, input) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', input });
  const created = run(['create', '--project', projectRoot, '--receipt', '.fleet/current.json', '--mode', 'overhaul', '--register', 'product', '--surface-mode', 'operate', '--target', 'app shell', '--json']);
  assert.equal(created.status, 0, created.stderr);
  assert.equal(readFileSync(resolve(projectRoot, '.fleet/design-review.json'), 'utf8'), 'historical receipt');
  const pending = JSON.parse(readFileSync(resolve(projectRoot, '.fleet/current.json'), 'utf8'));
  assert.equal(pending.direction.approval, 'pending');
  assert.equal(run(['preflight', '--project', projectRoot, '--receipt', '.fleet/current.json']).status, 1);
  const ready = completePersuadeReceipt();
  const evidencePaths = [ready.direction.before, ready.evidence.visualReview.report, ...ready.evidence.screenshots.map(({ path }) => path)];
  for (const relative of evidencePaths) {
    const file = resolve(projectRoot, relative);
    mkdirSync(resolve(file, '..'), { recursive: true });
    writeFileSync(file, 'Receipt-validation fixture; not real rendered product evidence.');
  }
  for (const checkpoint of ready.evidence.slopScale.checkpoints) {
    const file = resolve(projectRoot, checkpoint.report);
    mkdirSync(resolve(file, '..'), { recursive: true });
    writeFileSync(file, JSON.stringify(scoredSlopReport()));
  }
  writeFileSync(resolve(projectRoot, '.fleet/current.json'), JSON.stringify(ready));
  assert.equal(run(['preflight', '--project', projectRoot, '--receipt', '.fleet/current.json']).status, 0);
  assert.equal(run(['check', '--project', projectRoot, '--receipt', '.fleet/current.json']).status, 0);
  writeFileSync(resolve(projectRoot, ready.evidence.slopScale.checkpoints[1].report), 'not scanner JSON');
  const malformedScan = run(['check', '--project', projectRoot, '--receipt', '.fleet/current.json']);
  assert.equal(malformedScan.status, 1);
  assert.match(malformedScan.stderr, /readable runner JSON/);
  writeFileSync(resolve(projectRoot, ready.evidence.slopScale.checkpoints[1].report), JSON.stringify(scoredSlopReport()));
  ready.evidence.visualReview.checks.composition.status = 'fail';
  writeFileSync(resolve(projectRoot, '.fleet/current.json'), JSON.stringify(ready));
  assert.equal(run(['preflight', '--project', projectRoot, '--receipt', '.fleet/current.json']).status, 0);
  assert.equal(run(['check', '--project', projectRoot, '--receipt', '.fleet/current.json']).status, 1);
  const escaped = run(['create', '--project', projectRoot, '--receipt', '../outside.json', '--mode', 'preserve', '--register', 'product', '--surface-mode', 'operate', '--target', 'row']);
  assert.equal(escaped.status, 1);
  assert.match(escaped.stderr, /stay inside the project/);
});

test('prompt hook reinforces design gates throughout Fleet and ignores unrelated directories/events', () => {
  const cli = resolve(root, 'scripts/design-workflow.mjs');
  const run = (cwd, event = 'UserPromptSubmit') => spawnSync(process.execPath, [cli, 'prompt-hook'], {
    encoding: 'utf8', input: JSON.stringify({ cwd, hook_event_name: event }),
  });
  const inFleet = run(resolve(root, '../../human-v2'));
  assert.equal(inFleet.status, 0, inFleet.stderr);
  assert.match(JSON.parse(inFleet.stdout).hookSpecificOutput.additionalContext, /preflight/);
  assert.match(JSON.parse(inFleet.stdout).hookSpecificOutput.additionalContext, /slop scale at direction review, first working render, and final review/);
  assert.deepEqual(JSON.parse(run('/tmp').stdout), {});
  assert.deepEqual(JSON.parse(run(resolve(root, '../..') + '-unrelated').stdout), {});
  assert.deepEqual(JSON.parse(run(resolve(root, '../..'), 'Stop').stdout), {});
});

test('design routing installation is idempotent and preserves unrelated hooks in mixed groups', () => {
  const unrelated = { type: 'command', command: 'node other-policy.mjs' };
  const input = {
    description: 'Existing local hooks',
    hooks: {
      Stop: [{ hooks: [{ type: 'command', command: 'node recorder.mjs' }] }],
      UserPromptSubmit: [{ matcher: '*', hooks: [unrelated, { type: 'command', command: 'node /old/design-workflow.mjs prompt-hook' }] }],
    },
  };
  const installed = mergeDesignRoutingHook(input);
  assert.deepEqual(installed.hooks.Stop, input.hooks.Stop);
  assert.deepEqual(installed.hooks.UserPromptSubmit[0], { matcher: '*', hooks: [unrelated] });
  assert.equal(installed.hooks.UserPromptSubmit.length, 2);
  assert.deepEqual(mergeDesignRoutingHook(installed), installed);
  assert.equal(input.hooks.UserPromptSubmit[0].hooks.length, 2);
});

test('a visually passing persuade receipt fails when copy contradicts product purpose', () => {
  const receipt = completePersuadeReceipt();
  receipt.evidence.comprehension.mismatches.push(
    'The hero promises a public signup while the canonical next action says retained history only.',
  );
  assert.throws(
    () => validateDesignReview(receipt, policy, { projectRoot: root, pathExists: () => true, readReport: () => scoredSlopReport() }),
    /cannot pass with product-purpose contradictions/,
  );
});

test('a newer repository contract requires an explicit drift note', () => {
  const receipt = completePersuadeReceipt();
  receipt.direction.contract.purposeAlignment = 'repository-override';
  assert.throws(
    () => validateDesignReview(receipt, policy, { projectRoot: root, pathExists: () => true, readReport: () => scoredSlopReport() }),
    /repository purpose overrides require a drift note/,
  );
});

test('high visual scores cannot compensate for a weak purpose score', () => {
  const receipt = completePersuadeReceipt();
  receipt.evidence.critique.score = 40;
  receipt.evidence.audit.score = 20;
  receipt.evidence.comprehension.purposeScore.product = 5;
  receipt.evidence.comprehension.purposeScore.total = 80;
  assert.throws(
    () => validateDesignReview(receipt, policy, { projectRoot: root, pathExists: () => true, readReport: () => scoredSlopReport() }),
    /visual scores cannot compensate/,
  );
});

test('a Tailwind Plus review records the exact upstream component source', () => {
  const receipt = completePersuadeReceipt();
  receipt.direction.library.sources = [];
  assert.throws(
    () => validateDesignReview(receipt, policy, { projectRoot: root, pathExists: () => true, readReport: () => scoredSlopReport() }),
    /upstream library adoption requires at least one exact component or block URL/,
  );

  receipt.direction.library.sources.push('https://tailwindcss.com/plus/ui-blocks/marketing/sections/footers');
  receipt.direction.library.runtime = 'markup-only';
  assert.doesNotThrow(() =>
    validateDesignReview(receipt, policy, { projectRoot: root, pathExists: () => true, readReport: () => scoredSlopReport() }),
  );
});

test('a custom replacement requires explicit owner authorization and an upstream gap', () => {
  const receipt = completePersuadeReceipt();
  receipt.direction.library.primary = 'custom';
  receipt.direction.library.sources = [];
  receipt.direction.library.customReplacement.used = true;
  receipt.direction.library.customReplacement.authorization = 'agent-selected';
  receipt.direction.library.customReplacement.reason = 'No upstream component supports the interaction.';

  assert.throws(
    () => validateDesignReview(receipt, policy, { projectRoot: root, pathExists: () => true, readReport: () => scoredSlopReport() }),
    /explicit owner-requested authorization/,
  );
});

function nativeReceipt() {
  const receipt = completePersuadeReceipt();
  receipt.surfaceMode = 'operate';
  receipt.context.design = 'docs/native-design.md';
  receipt.evidence.platform = 'native-macos';
  receipt.evidence.slopScale = { platform: 'native', posture: 'advisory', reason: 'Synthetic native fixture is outside the browser scanner capability.', checkpoints: [] };
  receipt.evidence.supportedMinimumWidth = 600;
  receipt.evidence.screenshots = [600, 900, 1200].map((width) => ({
    width, height: 700, path: `artifacts/native-${width}.png`,
  }));
  return receipt;
}

// Mock file contents keep profile tests independent of filesystem fixtures.
const nativeOptions = {
  projectRoot: root,
  pathExists: () => true,
  readReport: () => scoredSlopReport(),
  readEvidenceFile: (file, encoding) => encoding
    ? 'Platform: native-macos\nSupported minimum width: 600\n'
    : Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.from(file)]),
};

test('native macOS evidence passes without browser viewports in both review APIs', () => {
  assert.doesNotThrow(() => validateDesignReview(nativeReceipt(), policy, nativeOptions));
  assert.doesNotThrow(() => validateDesignReviewEvidence(nativeReceipt(), policy, nativeOptions));
});

for (const minimum of [undefined, 599, 600.5, '600', null, Number.MAX_SAFE_INTEGER + 1]) {
  test(`native macOS rejects invalid supported minimum ${String(minimum)}`, () => {
    const receipt = nativeReceipt();
    receipt.evidence.supportedMinimumWidth = minimum;
    assert.throws(() => validateDesignReview(receipt, policy, nativeOptions), /integer at least 600/);
  });
}

for (const [name, mutate, expected] of [
  ['too few screenshots', (r) => r.evidence.screenshots.pop(), /at least three distinct actual screenshots/],
  ['no minimum capture', (r) => { r.evidence.screenshots[0].width = 700; }, /screenshot at supportedMinimumWidth/],
  ['repeated window widths', (r) => { r.evidence.screenshots[1].width = 600; }, /three distinct window widths/],
  ['below minimum', (r) => { r.evidence.screenshots[1].width = 390; }, /at or above supportedMinimumWidth/],
  ['fractional width', (r) => { r.evidence.screenshots[1].width = 900.5; }, /width must be an integer/],
  ['missing height', (r) => { delete r.evidence.screenshots[1].height; }, /height must be a positive integer/],
  ['zero height', (r) => { r.evidence.screenshots[1].height = 0; }, /height must be a positive integer/],
  ['duplicate path', (r) => { r.evidence.screenshots[1].path = r.evidence.screenshots[0].path; }, /distinct screenshot path/],
  ['aliased path', (r) => { r.evidence.screenshots[1].path = 'artifacts/../artifacts/native-600.png'; }, /distinct screenshot path/],
  ['missing path', (r) => { delete r.evidence.screenshots[1].path; }, /path is required/],
  ['outside path', (r) => { r.evidence.screenshots[1].path = '../capture.png'; }, /must stay inside the project/],
  ['non-array captures', (r) => { r.evidence.screenshots = {}; }, /at least three distinct actual screenshots/],
  ['unknown profile', (r) => { r.evidence.platform = 'desktop'; }, /evidence.platform must be/],
  ['failed project check', (r) => { r.evidence.projectCheck.status = 'fail'; }, /passing project check/],
  ['unresolved P1', (r) => { r.evidence.unresolved.p1 = 1; }, /unresolved P1/],
  ['low critique', (r) => { r.evidence.critique.score = 31; }, /critique score/],
]) {
  test(`native macOS rejects ${name}`, () => {
    const receipt = nativeReceipt();
    mutate(receipt);
    assert.throws(() => validateDesignReview(receipt, policy, nativeOptions), expected);
  });
}

test('native macOS requires readable, matching native design documentation', () => {
  for (const document of [
    '', 'Platform: web\nSupported minimum width: 600',
    'Platform: native-macos', 'Platform: native-macos\nSupported minimum width: 800',
  ]) {
    assert.throws(() => validateDesignReview(nativeReceipt(), policy, {
      ...nativeOptions,
      readEvidenceFile: (file, encoding) => encoding ? document : nativeOptions.readEvidenceFile(file),
    }), /context.design must document/);
  }
  assert.throws(() => validateDesignReview(nativeReceipt(), policy, {
    ...nativeOptions, readEvidenceFile: () => { throw new Error('missing'); },
  }), /must be readable/);
});

test('native macOS rejects missing, non-image, and copied screenshot files', () => {
  assert.throws(() => validateDesignReview(nativeReceipt(), policy, {
    ...nativeOptions, pathExists: (file) => !file.endsWith('native-900.png'),
  }), /does not exist/);
  for (const bytes of [Buffer.from('not an image'), Buffer.from('89504e470d0a1a0a00', 'hex')]) {
    assert.throws(() => validateDesignReview(nativeReceipt(), policy, {
      ...nativeOptions,
      readEvidenceFile: (file, encoding) => encoding ? nativeOptions.readEvidenceFile(file, encoding) : bytes,
    }), /must be a PNG|distinct screenshot image/);
  }
});

test('legacy and explicit web receipts keep required viewports despite a native minimum field', () => {
  for (const platform of [undefined, 'web']) {
    const receipt = completePersuadeReceipt();
    receipt.evidence.platform = platform;
    receipt.evidence.supportedMinimumWidth = 600;
    assert.doesNotThrow(() => validateDesignReview(receipt, policy, nativeOptions));
    receipt.evidence.screenshots = nativeReceipt().evidence.screenshots;
    assert.throws(() => validateDesignReview(receipt, policy, nativeOptions), /missing required viewport 390/);
  }
});

test('create opts in to native evidence and rejects invalid profiles before creating a receipt', () => {
  const project = mkdtempSync(resolve(tmpdir(), 'design-workflow-create-'));
  const create = (extra, target = project) => spawnSync(process.execPath, [
    resolve(root, 'scripts/design-workflow.mjs'), 'create', '--project', target,
    '--mode', 'preserve', '--register', 'product', '--surface-mode', 'operate',
    '--target', 'native window', '--json', ...extra,
  ], { encoding: 'utf8' });
  for (const extra of [
    ['--platform', 'unknown'], ['--platform', 'native-macos'],
    ['--platform', 'native-macos', '--supported-minimum-width', '599'],
    ['--platform', 'native-macos', '--supported-minimum-width', '600.5'],
    ['--supported-minimum-width', '600'],
  ]) {
    assert.equal(create(extra).status, 1);
  }
  assert.equal(create(['--platform', 'native-macos', '--supported-minimum-width', '800']).status, 0);
  const receipt = JSON.parse(readFileSync(resolve(project, '.fleet/design-review.json'), 'utf8'));
  assert.equal(receipt.evidence.platform, 'native-macos');
  assert.equal(receipt.evidence.slopScale.platform, 'native');
  assert.match(receipt.evidence.slopScale.reason, /browser slop scanner cannot inspect/);
  assert.deepEqual(receipt.evidence.slopScale.checkpoints, []);
  assert.equal(receipt.evidence.supportedMinimumWidth, 800);
  assert.deepEqual(receipt.evidence.screenshots.map((s) => s.width), [800, 1000, 1200]);
  assert.ok(receipt.evidence.screenshots.every((s) => s.height === null));
  const webProject = mkdtempSync(resolve(tmpdir(), 'design-workflow-web-'));
  assert.equal(create([], webProject).status, 0);
  const web = JSON.parse(readFileSync(resolve(webProject, '.fleet/design-review.json'), 'utf8'));
  assert.equal(web.evidence.platform, 'web');
  assert.deepEqual(web.evidence.screenshots, template.evidence.screenshots);
});
