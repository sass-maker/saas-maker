import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { afterEach } from 'node:test';

import {
  auditFooterSources,
  inspectFooterSource,
  inspectStudioFooter,
  validateManifest,
} from '../scripts/footer-source-audit.mjs';

const scratch = [];

afterEach(() => {
  for (const path of scratch.splice(0)) rmSync(path, { recursive: true, force: true });
});

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), 'footer-source-audit-'));
  scratch.push(root);
  for (const [path, source] of Object.entries(files)) {
    const absolute = join(root, path);
    mkdirSync(join(absolute, '..'), { recursive: true });
    writeFileSync(absolute, source);
  }
  return root;
}

function manifest(surfaces) {
  return { schemaVersion: 1, updatedAt: '2026-09-01', surfaces };
}

const paired = '<script src="https://sassmaker.com/project-strip.js"></script>\n'
  + '<script src="/ai-chat-footer.js"></script>\n';

test('inspectFooterSource recognizes hosted and same-origin loader names', () => {
  assert.deepEqual(inspectFooterSource(paired), {
    projectStripLoaders: 1,
    aiFooterLoaders: 1,
    ordered: true,
    composeOptOut: false,
  });
  assert.equal(
    inspectFooterSource('<script src="/portfolio-project-strip.js"></script>').projectStripLoaders,
    1,
  );
});

test('a required visual surface and shared factory pass when every named file is paired', () => {
  const root = fixture({ 'product/layout.astro': paired, 'factory/layout.astro': paired });
  const report = auditFooterSources({
    fleetRoot: root,
    now: Date.parse('2026-09-01T00:00:00.000Z'),
    manifest: manifest([
      { id: 'product', kind: 'visual', state: 'required', files: ['product/layout.astro'] },
      { id: 'factory', kind: 'factory', state: 'required', files: ['factory/layout.astro'] },
    ]),
  });
  assert.deepEqual(report.summary, {
    visual: 1,
    factories: 1,
    required: 2,
    compliant: 2,
    compliantVisual: 1,
    compliantFactories: 1,
    compliantForms: { precise: 2, studio: 0 },
    acknowledgedExceptions: 0,
    findings: 0,
    blocking: 0,
  });
});

test('missing loaders, reversed order, opt-outs, and missing files block required source', () => {
  const root = fixture({
    'product/reversed.html': '<script src="/ai-chat-footer.js"></script><script src="/project-strip.js"></script>',
    'product/opt-out.html': '<script src="/project-strip.js"></script><script src="/ai-chat-footer.js" data-compose="false"></script>',
  });
  const report = auditFooterSources({
    fleetRoot: root,
    manifest: manifest([
      {
        id: 'product',
        kind: 'visual',
        state: 'required',
        files: ['product/reversed.html', 'product/opt-out.html', 'product/missing.html'],
      },
    ]),
  });
  assert.deepEqual(
    report.blocking.map((entry) => entry.code).sort(),
    ['COMPOSE_OPT_OUT', 'LOADER_ORDER', 'MISSING_SOURCE'],
  );
});

test('a dated retirement exception reports matching debt and fails when it becomes stale', () => {
  const debt = '<script src="/project-strip.js"></script><script src="/ai-chat-footer.js" data-compose={false}></script>';
  const exception = {
    id: 'retired-product',
    kind: 'visual',
    state: 'retired-exception',
    files: ['retired/index.html'],
    allows: ['COMPOSE_OPT_OUT'],
    recordedAt: '2026-09-01',
    reason: 'The retired repository requires owner approval before source reactivation.',
  };
  const root = fixture({ 'retired/index.html': debt });
  const report = auditFooterSources({ fleetRoot: root, manifest: manifest([exception]) });
  assert.equal(report.summary.acknowledgedExceptions, 1);
  assert.equal(report.summary.blocking, 0);
  assert.equal(report.findings[0].code, 'COMPOSE_OPT_OUT');

  rmSync(join(root, 'retired/index.html'));
  const missing = auditFooterSources({ fleetRoot: root, manifest: manifest([exception]) });
  assert.equal(missing.blocking.some((entry) => entry.code === 'MISSING_SOURCE'), true);

  writeFileSync(join(root, 'retired/index.html'), paired);
  const stale = auditFooterSources({ fleetRoot: root, manifest: manifest([exception]) });
  assert.equal(stale.blocking[0].code, 'STALE_EXCEPTION');
});

test('manifest validation rejects unknown fields, duplicate ids, and unsafe paths', () => {
  const result = validateManifest(manifest([
    { id: 'same', kind: 'visual', state: 'required', files: ['safe.html'], surprise: true },
    { id: 'same', kind: 'visual', state: 'required', files: ['../unsafe.html'] },
  ]));
  assert.equal(result.valid, false);
  assert.match(result.problems.join('\n'), /unsupported field surprise/u);
  assert.match(result.problems.join('\n'), /duplicate id/u);
  assert.match(result.problems.join('\n'), /safe relative paths/u);
});

const studioHtml = '<footer data-fleet-footer="studio" data-catalog-id="product"></footer>';
const studioContent = (catalogId) => JSON.stringify({
  template: 'gallery',
  footer: { summary: 'A product.', catalogId, capture: 'newsletter', feedbackKey: 'pk_test' },
});
const uiPackage = JSON.stringify({ name: 'product-site', dependencies: { '@saas-maker/ui': 'file:../ui' } });

test('inspectStudioFooter reads the rendered marker and the content JSON catalog id', () => {
  assert.deepEqual(inspectStudioFooter(studioHtml), {
    studioMarkers: 1,
    studioCatalogIds: ['product'],
    contentCatalogId: null,
  });
  assert.equal(inspectStudioFooter(studioContent('product'), { json: true }).contentCatalogId, 'product');
  assert.equal(inspectStudioFooter('{not json', { json: true }).contentCatalogId, null);
  assert.equal(inspectStudioFooter(paired).studioMarkers, 0);
});

test('inspectStudioFooter reads the authored element and library-call catalog ids', () => {
  assert.deepEqual(
    inspectStudioFooter('<studio-footer data-mode="dark" catalog-id="product"></studio-footer>').studioCatalogIds,
    ['product'],
  );
  assert.deepEqual(
    inspectStudioFooter("import { renderStudioFooterHtml } from '@saas-maker/ui/footer-html';\nrender({ catalogId: 'product' });").studioCatalogIds,
    ['product'],
  );
  assert.deepEqual(
    inspectStudioFooter('const f = document.createElement("studio-footer"); f.setAttribute("catalog-id", "product");').studioCatalogIds,
    ['product'],
  );
  assert.equal(inspectStudioFooter("const catalogId = 'product';").studioMarkers, 0);
});

test('a rendered UI-library studio footer passes without Precise loaders', () => {
  const root = fixture({ 'product/dist/index.html': studioHtml });
  const report = auditFooterSources({
    fleetRoot: root,
    manifest: manifest([
      { id: 'product', kind: 'visual', state: 'required', files: ['product/dist/index.html'] },
    ]),
  });
  assert.equal(report.summary.blocking, 0);
  assert.deepEqual(report.summary.compliantForms, { precise: 0, studio: 1 });
  assert.equal(report.results[0].files[0].form, 'studio');
});

test('a UI-library content JSON passes with a matching catalog id and library dependency', () => {
  const root = fixture({
    'product/.git/HEAD': 'ref: refs/heads/main\n',
    'product/package.json': JSON.stringify({ name: 'workspace' }),
    'product/site/package.json': JSON.stringify({ devDependencies: { '@saas-maker/templates': '0.1.7' } }),
    'product/site/src/content/product.json': studioContent('product'),
    'other/package.json': uiPackage,
    'other/site/src/content/site.json': studioContent('other'),
  });
  const report = auditFooterSources({
    fleetRoot: root,
    manifest: manifest([
      { id: 'product', kind: 'visual', state: 'required', files: ['product/site/src/content/product.json'] },
      { id: 'other', kind: 'visual', state: 'required', files: ['other/site/src/content/site.json'] },
    ]),
  });
  assert.equal(report.summary.blocking, 0);
  assert.deepEqual(report.summary.compliantForms, { precise: 0, studio: 2 });
  assert.deepEqual(report.results[0].files[0].uiLibraryDependency, {
    package: '@saas-maker/templates',
    manifest: 'product/site/package.json',
  });
});

test('studio footers block on a wrong catalog id or a missing UI-library dependency', () => {
  const root = fixture({
    'wrong/dist/index.html': '<footer data-fleet-footer="studio" data-catalog-id="someone-else"></footer>',
    'unlabelled/dist/index.html': '<footer data-fleet-footer="studio"></footer>',
    'content/package.json': uiPackage,
    'content/src/content/site.json': studioContent('someone-else'),
    'nodep/.git/HEAD': 'ref: refs/heads/main\n',
    'nodep/package.json': JSON.stringify({ dependencies: { react: '19.0.0' } }),
    'nodep/src/content/site.json': studioContent('nodep'),
    // A dependency above the repository root does not count.
    'package.json': uiPackage,
  });
  const report = auditFooterSources({
    fleetRoot: root,
    manifest: manifest([
      { id: 'wrong', kind: 'visual', state: 'required', files: ['wrong/dist/index.html'] },
      { id: 'unlabelled', kind: 'visual', state: 'required', files: ['unlabelled/dist/index.html'] },
      { id: 'content', kind: 'visual', state: 'required', files: ['content/src/content/site.json'] },
      { id: 'nodep', kind: 'visual', state: 'required', files: ['nodep/src/content/site.json'] },
    ]),
  });
  assert.deepEqual(
    report.blocking.map((entry) => `${entry.surface}:${entry.code}`).sort(),
    [
      'content:STUDIO_CATALOG_ID',
      'nodep:MISSING_UI_LIBRARY',
      'unlabelled:STUDIO_CATALOG_ID',
      'wrong:STUDIO_CATALOG_ID',
    ],
  );
  assert.equal(report.summary.compliant, 0);
});

test('a content JSON without a footer catalog id still needs the Precise loaders', () => {
  const root = fixture({
    'product/package.json': uiPackage,
    'product/src/content/site.json': JSON.stringify({ footer: { summary: 'No catalog id.' } }),
  });
  const report = auditFooterSources({
    fleetRoot: root,
    manifest: manifest([
      { id: 'product', kind: 'visual', state: 'required', files: ['product/src/content/site.json'] },
    ]),
  });
  assert.deepEqual(
    report.blocking.map((entry) => entry.code).sort(),
    ['MISSING_AI_FOOTER', 'MISSING_PROJECT_STRIP'],
  );
});

test('Precise and studio surfaces are counted separately in one receipt', () => {
  const root = fixture({ 'precise/layout.astro': paired, 'product/dist/index.html': studioHtml });
  const report = auditFooterSources({
    fleetRoot: root,
    manifest: manifest([
      { id: 'precise', kind: 'visual', state: 'required', files: ['precise/layout.astro'] },
      { id: 'product', kind: 'visual', state: 'required', files: ['product/dist/index.html'] },
    ]),
  });
  assert.equal(report.summary.blocking, 0);
  assert.equal(report.summary.compliantVisual, 2);
  assert.deepEqual(report.summary.compliantForms, { precise: 1, studio: 1 });
  assert.equal(report.results[0].files[0].form, 'precise');
});
