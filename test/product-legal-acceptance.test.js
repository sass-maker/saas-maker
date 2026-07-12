import assert from 'node:assert/strict';
import test from 'node:test';

import {
  LegalAcceptanceError,
  recordLegalAcceptance,
  requireCurrentAcceptance,
  verifyLegalAcceptance,
} from '../src/product/legal-acceptance.js';

const hash = 'a'.repeat(64);

test('legal acceptance is immutable, versioned, and integrity-verifiable', () => {
  const acceptance = recordLegalAcceptance({
    subjectId: 'actor-a', workspaceId: 'workspace-a', document: 'actor-licence', version: '2026-07',
    contentHash: hash, source: 'customer-app', acceptedAt: '2026-07-01T00:00:00.000Z',
  });
  assert.equal(Object.isFrozen(acceptance), true);
  assert.equal(verifyLegalAcceptance(acceptance), true);
  assert.equal(verifyLegalAcceptance({ ...acceptance, version: 'changed' }), false);
  assert.strictEqual(requireCurrentAcceptance({
    acceptances: [acceptance], subjectId: 'actor-a', workspaceId: 'workspace-a',
    document: 'actor-licence', version: '2026-07', contentHash: hash,
  }), acceptance);
});

test('materially changed documents require a new acceptance', () => {
  const acceptance = recordLegalAcceptance({
    subjectId: 'user-a', workspaceId: 'workspace-a', document: 'terms', version: '1',
    contentHash: hash, source: 'customer-app',
  });
  assert.throws(() => requireCurrentAcceptance({
    acceptances: [acceptance], subjectId: 'user-a', workspaceId: 'workspace-a',
    document: 'terms', version: '2', contentHash: 'b'.repeat(64),
  }), LegalAcceptanceError);
});
