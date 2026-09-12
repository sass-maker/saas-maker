import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { saveCatalog } from './catalog-store.mjs';
import { compatibilityCatalog, structureCatalog } from './catalog-schema.mjs';

test('maintenance writes preserve structured storage and reject stale or unmapped edits', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'catalog-schema-'));
  const path = join(directory, 'projects.json');
  try {
    const original = {
      projects: [
        {
          id: 'example',
          notes: 'Exact owner comment',
          externalDependency: 'retained',
          lifecycle: { status: 'inactive' },
        },
      ],
    };
    const raw = JSON.stringify(structureCatalog(original));
    await writeFile(path, raw);
    const edited = structuredClone(original);
    edited.projects[0].lifecycle.status = 'active';
    await saveCatalog(path, edited, raw);
    const saved = await readFile(path, 'utf8');
    assert.equal(JSON.parse(saved).catalogSchemaVersion, 2);
    assert.deepEqual(compatibilityCatalog(JSON.parse(saved)), edited);
    await assert.rejects(saveCatalog(path, original, raw), /changed while editing/);
    assert.equal(await readFile(path, 'utf8'), saved);
    const unsupported = JSON.parse(saved);
    unsupported.projects[0].ownerNotes.newUnmappedComment = 'Must survive';
    const unsupportedRaw = JSON.stringify(unsupported);
    await writeFile(path, unsupportedRaw);
    await assert.rejects(saveCatalog(path, edited, unsupportedRaw), /Unmapped source fields/);
    assert.equal(await readFile(path, 'utf8'), unsupportedRaw);
  } finally {
    await rm(directory, { recursive: true });
  }
});

test('round-trip preserves comments, conflicting statuses, dependencies and unknown fields', () => {
  const original = {
    _meta: { future: ['untouched'] },
    projects: [
      {
        id: 'example',
        name: 'Example',
        notes: 'My exact words.\n  Including whitespace 🪴',
        ownerNarrative: { message: 'Do not paraphrase', capturedAt: null },
        status: 'local-only',
        lifecycle: { status: 'inactive', shareable: false, resumeCondition: null },
        portfolio: { status: 'active', futureForm: 'paused-experiment', readyToBeShared: true },
        databaseResources: [
          { provider: 'external', state: 'rollback-held', unknown: [null, false, 0, ''] },
        ],
        externalDependencies: { billing: 'owner account', unknown: {} },
        public: { description: 'Distinct public words' },
      },
    ],
    publicDirectory: {
      schemaVersion: 5,
      projects: { example: { makerNote: 'Another exact comment' }, orphan: {} },
    },
    repositoryReview: {
      repositories: [{ originalRepository: 'owner/repo', futureForm: 'paused-experiment' }],
    },
    infrastructure: { projects: { example: { provider: 'kept' } } },
    extraTopLevel: { arbitrary: true },
  };
  const source = structureCatalog(original);
  assert.equal(source.projects[0].ownerNotes.notes, original.projects[0].notes);
  assert.equal(source.projects[0].deployment.status, 'local-only');
  assert.equal(source.projects[0].lifecycle.status, 'inactive');
  assert.equal(source.projects[0].lifecycle.portfolioStatus, 'active');
  assert.deepEqual(compatibilityCatalog(source), original);
  assert.deepEqual(structureCatalog(compatibilityCatalog(source)), source);
});

test('missing, null and empty values remain distinct without adding defaults', () => {
  for (const fields of [
    {},
    { portfolio: {} },
    { lifecycle: null },
    { public: {} },
    { notes: '' },
    { personalUse: false },
  ]) {
    const original = { projects: [{ id: 'example', ...fields }] };
    assert.deepEqual(compatibilityCatalog(structureCatalog(original)), original);
  }
});

test('edits in the source drive the legacy consumers without a second classification', () => {
  const source = structureCatalog({
    projects: [
      {
        id: 'example',
        portfolio: { futureForm: 'paused-experiment' },
        lifecycle: { shareable: false },
      },
    ],
  });
  source.projects[0].classification.futureForm = 'personal-tool';
  source.projects[0].sharing.shareable = true;
  const result = compatibilityCatalog(source).projects[0];
  assert.equal(result.portfolio.futureForm, 'personal-tool');
  assert.equal(result.lifecycle.shareable, true);
});
