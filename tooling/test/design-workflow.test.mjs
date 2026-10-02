import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';

import { validateDesignReview, validateDesignReviewEvidence } from '../lib/design-workflow.mjs';

const root = resolve(import.meta.dirname, '..');
const policy = JSON.parse(readFileSync(resolve(root, 'config/design-workflow.json'), 'utf8'));
const template = JSON.parse(readFileSync(resolve(root, 'templates/design-review.json'), 'utf8'));

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
  };
  receipt.direction.library.sources.push('https://tailwindcss.com/plus/ui-blocks/marketing/sections/footers');
  receipt.direction.library.runtime = 'markup-only';
  receipt.evidence.projectCheck = { command: 'pnpm test', status: 'pass' };
  receipt.evidence.critique.score = 32;
  receipt.evidence.audit.score = 16;
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
      pathExists: () => true,
    }),
  );
});

test('a visually passing persuade receipt fails when copy contradicts product purpose', () => {
  const receipt = completePersuadeReceipt();
  receipt.evidence.comprehension.mismatches.push(
    'The hero promises a public signup while the canonical next action says retained history only.',
  );
  assert.throws(
    () => validateDesignReview(receipt, policy, { projectRoot: root, pathExists: () => true }),
    /cannot pass with product-purpose contradictions/,
  );
});

test('a newer repository contract requires an explicit drift note', () => {
  const receipt = completePersuadeReceipt();
  receipt.direction.contract.purposeAlignment = 'repository-override';
  assert.throws(
    () => validateDesignReview(receipt, policy, { projectRoot: root, pathExists: () => true }),
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
    () => validateDesignReview(receipt, policy, { projectRoot: root, pathExists: () => true }),
    /visual scores cannot compensate/,
  );
});

test('a Tailwind Plus review records the exact upstream component source', () => {
  const receipt = completePersuadeReceipt();
  receipt.direction.library.sources = [];
  assert.throws(
    () => validateDesignReview(receipt, policy, { projectRoot: root, pathExists: () => true }),
    /upstream library adoption requires at least one exact component or block URL/,
  );

  receipt.direction.library.sources.push('https://tailwindcss.com/plus/ui-blocks/marketing/sections/footers');
  receipt.direction.library.runtime = 'markup-only';
  assert.doesNotThrow(() =>
    validateDesignReview(receipt, policy, { projectRoot: root, pathExists: () => true }),
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
    () => validateDesignReview(receipt, policy, { projectRoot: root, pathExists: () => true }),
    /explicit owner-requested authorization/,
  );
});

function nativeReceipt() {
  const receipt = completePersuadeReceipt();
  receipt.surfaceMode = 'operate';
  receipt.context.design = 'docs/native-design.md';
  receipt.evidence.platform = 'native-macos';
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
  assert.equal(receipt.evidence.supportedMinimumWidth, 800);
  assert.deepEqual(receipt.evidence.screenshots.map((s) => s.width), [800, 1000, 1200]);
  assert.ok(receipt.evidence.screenshots.every((s) => s.height === null));
  const webProject = mkdtempSync(resolve(tmpdir(), 'design-workflow-web-'));
  assert.equal(create([], webProject).status, 0);
  const web = JSON.parse(readFileSync(resolve(webProject, '.fleet/design-review.json'), 'utf8'));
  assert.equal(web.evidence.platform, 'web');
  assert.deepEqual(web.evidence.screenshots, template.evidence.screenshots);
});
