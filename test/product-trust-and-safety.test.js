import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TrustSafetyError,
  completeDataRightsJob,
  createDataRightsJob,
  createMisuseReport,
  createTakedown,
  evaluateRepeatAbuse,
  hashSensitiveReportText,
  reviewClaims,
  transitionMisuseReport,
} from '../src/product/trust-and-safety.js';

test('claim review blocks claims without matching evidence', () => {
  const review = reviewClaims({ claims: [{ id: 'claim-a', evidenceId: 'evidence-a' }, { id: 'claim-b' }],
    evidence: [{ id: 'evidence-a' }], policyVersion: 'policy-a', reviewerId: 'reviewer-a' });
  assert.equal(review.accepted, false);
  assert.deepEqual(review.decisions.map((decision) => decision.status), ['supported', 'blocked']);
});

test('misuse reports support investigation, takedown, appeal, and repeat-abuse restriction', () => {
  const initial = createMisuseReport({ subjectType: 'output', subjectId: 'output-a', reporterId: 'reporter-a', category: 'impersonation',
    descriptionHash: hashSensitiveReportText('sensitive evidence') });
  const investigating = transitionMisuseReport(initial, 'investigating', { actorId: 'moderator-a', reasonCode: 'triage' });
  const actioned = transitionMisuseReport(investigating, 'actioned', { actorId: 'moderator-a', reasonCode: 'confirmed' });
  assert.equal(createTakedown({ report: actioned, outputId: 'output-a', actorId: 'moderator-a' }).status, 'active');
  const appealed = transitionMisuseReport(actioned, 'appealed', { actorId: 'owner-a', reasonCode: 'appeal', appealEvidenceHash: 'a'.repeat(64) });
  assert.equal(appealed.status, 'appealed');
  assert.equal(evaluateRepeatAbuse({ reports: [actioned, actioned, appealed], subjectId: 'output-a' }).restricted, true);
});

test('data export/deletion jobs require purpose-bound retention evidence', () => {
  const job = createDataRightsJob({ workspaceId: 'workspace-a', subjectId: 'user-a', kind: 'delete', policyVersion: 'retention-a', idempotencyKey: 'delete-a' });
  assert.throws(() => completeDataRightsJob(job, { evidence: { receiptId: 'receipt-a' }, retainedRecords: [{ type: 'licence-proof' }] }), TrustSafetyError);
  const completed = completeDataRightsJob(job, { evidence: { receiptId: 'receipt-a' }, retainedRecords: [
    { type: 'licence-proof', purpose: 'delivered-output-proof', deleteAfter: '2033-01-01T00:00:00.000Z' },
  ] });
  assert.equal(completed.status, 'completed');
  assert.equal(completed.audit.at(-1).receiptId, 'receipt-a');
});
