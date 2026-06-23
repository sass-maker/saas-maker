#!/usr/bin/env node
/**
 * End-to-end fleet harness against a LOCAL worker + real local D1.
 * Proves auth + every transfer (events, task claim/complete/fail) for real —
 * exactly the behaviors unit tests (mocked DB) can't cover.
 *
 * Setup (no prod, no deploy):
 *   cd workers/api
 *   npx wrangler d1 migrations apply saasmaker-db --local
 *   npx wrangler dev --port 8787 --var LOCAL_AUTH_BYPASS:true --var CORS_ORIGIN:"*" --var APP_BASE_URL:"http://localhost:3000"
 *   node ../../scripts/e2e-fleet-local.mjs
 */
const BASE = process.env.BASE || 'http://localhost:8787';
const TOKEN = process.env.TOKEN || 'local-dev-session'; // LOCAL_AUTH_BYPASS default
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` };

let pass = 0,
  fail = 0;
function check(name, cond, detail = '') {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}  ${detail}`);
  }
}
async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: H,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

console.log('\n=== 1. AUTH ===');
const me = await api('GET', '/v1/projects');
check(
  'GET /v1/projects authenticates (local bypass token)',
  me.status === 200,
  `status ${me.status}`
);

console.log('\n=== 2. EVENTS (push + real idempotent dedup) ===');
const idem = `e2e-${Date.now()}`;
const ev1 = await api('POST', '/v1/events', {
  product: 'psi-swarm',
  type: 'audit.completed',
  idempotency_key: idem,
  payload: { p75: 1800 },
});
check(
  'emit event → accepted=1',
  ev1.status === 201 && ev1.json.accepted === 1,
  JSON.stringify(ev1.json)
);
const ev2 = await api('POST', '/v1/events', {
  product: 'psi-swarm',
  type: 'audit.completed',
  idempotency_key: idem,
  payload: { p75: 1800 },
});
check(
  're-emit same idempotency_key → deduped=1 (real D1 ON CONFLICT)',
  ev2.status === 201 && ev2.json.deduped === 1,
  JSON.stringify(ev2.json)
);
const evList = await api('GET', '/v1/events?product=psi-swarm&type=audit.completed');
check(
  'event readable back via GET',
  evList.status === 200 && evList.json.data.some((e) => e.idempotency_key === idem)
);

console.log('\n=== 3. TASK QUEUE (produce → claim → complete) ===');
const created = await api('POST', '/v1/tasks', {
  title: 'Audit homepage',
  capability: 'audit',
  project_slug: 'linkchat',
});
check(
  'produce task with capability',
  created.status === 201 && created.json.data.capability === 'audit',
  JSON.stringify(created.json).slice(0, 160)
);
const taskId = created.json?.data?.id;
const claim1 = await api('POST', '/v1/tasks/claim', {
  worker: 'psi-swarm@e2e',
  capability: 'audit',
});
check(
  'worker claims it (status→in_progress, leased)',
  claim1.status === 200 &&
    claim1.json.data.id === taskId &&
    claim1.json.data.status === 'in_progress',
  JSON.stringify(claim1.json).slice(0, 160)
);
const claim2 = await api('POST', '/v1/tasks/claim', { worker: 'other@e2e', capability: 'audit' });
check(
  'second claim → 204 (no longer pending — atomic)',
  claim2.status === 204,
  `status ${claim2.status}`
);
const done = await api('POST', `/v1/tasks/${taskId}/complete`, {
  worker: 'psi-swarm@e2e',
  result: 'p75 LCP 1.8s',
});
check(
  'complete by lease holder → status done',
  done.status === 200 && done.json.data.status === 'done',
  JSON.stringify(done.json).slice(0, 160)
);
const wrongComplete = await api('POST', `/v1/tasks/${taskId}/complete`, { worker: 'imposter@e2e' });
check(
  'complete by non-holder → 409',
  wrongComplete.status === 409,
  `status ${wrongComplete.status}`
);

console.log('\n=== 4. FAIL → REQUEUE → reclaim ===');
const t2 = await api('POST', '/v1/tasks', { title: 'Flaky audit', capability: 'audit' });
const t2id = t2.json.data.id;
await api('POST', '/v1/tasks/claim', { worker: 'w@e2e', capability: 'audit' });
const failed = await api('POST', `/v1/tasks/${t2id}/fail`, {
  worker: 'w@e2e',
  error: 'timeout',
  max_attempts: 5,
});
check(
  'fail under max_attempts → requeued',
  failed.status === 200 && failed.json.outcome.requeued === true,
  JSON.stringify(failed.json).slice(0, 160)
);
const reclaim = await api('POST', '/v1/tasks/claim', { worker: 'w2@e2e', capability: 'audit' });
check(
  'requeued task is reclaimable by another worker',
  reclaim.status === 200 && reclaim.json.data.id === t2id,
  JSON.stringify(reclaim.json).slice(0, 120)
);

console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);
