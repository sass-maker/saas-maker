import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DeepSeekClient, generateLessonScripts } from '../src/adapters/deepseek.js';
import { normalizeLessonInput } from '../src/lesson-intake.js';

function makeFetchStub({ responses }) {
  let callCount = 0;
  const calls = [];
  const fetchImpl = async (url, init) => {
    const call = { url, init };
    calls.push(call);
    const response = responses[callCount] ?? responses[responses.length - 1];
    callCount += 1;
    return {
      ok: response.ok ?? true,
      status: response.status ?? 200,
      json: async () => response.body,
      text: async () => JSON.stringify(response.body),
    };
  };
  return { fetchImpl, calls };
}

function buildPayload(overrides = {}) {
  return {
    choices: [
      {
        message: {
          content: JSON.stringify({
            hook: overrides.hook ?? 'You think closures are scary — they are not.',
            hashtags: overrides.hashtags ?? ['#javascript', '#webdev', '#100daysofcode'],
            scenes: overrides.scenes ?? [
              { label: 'hook', narration: 'Closures are easier than you think.', brollQuery: 'coding laptop', durationSeconds: 4 },
              { label: 'concept', narration: 'A closure is a function plus its scope.', brollQuery: 'abstract neural network', durationSeconds: 8 },
              { label: 'example', narration: 'makeCounter remembers its count.', brollQuery: 'counter app demo', durationSeconds: 10 },
              { label: 'recap', narration: 'Function plus captured variables.', brollQuery: 'whiteboard concept', durationSeconds: 4 },
              { label: 'cta', narration: 'Follow for daily JS lessons.', brollQuery: 'student notebook', durationSeconds: 4 },
            ],
          }),
        },
      },
    ],
  };
}

test('DeepSeekClient.chatJson posts to /chat/completions with bearer + parses JSON', async () => {
  const { fetchImpl, calls } = makeFetchStub({ responses: [{ body: buildPayload() }] });
  const client = new DeepSeekClient({ apiKey: 'test-key', fetchImpl });
  const result = await client.chatJson([{ role: 'user', content: 'hi' }]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.deepseek.com/chat/completions');
  assert.equal(calls[0].init.headers.authorization, 'Bearer test-key');
  assert.equal(calls[0].init.headers['content-type'], 'application/json');
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.model, 'deepseek-chat');
  assert.equal(body.response_format.type, 'json_object');
  assert.ok(result.scenes.length);
});

test('DeepSeekClient surfaces non-2xx errors', async () => {
  const { fetchImpl } = makeFetchStub({ responses: [{ ok: false, status: 429, body: 'rate limited' }] });
  const client = new DeepSeekClient({ apiKey: 'k', fetchImpl });
  await assert.rejects(client.chatJson([{ role: 'user', content: 'hi' }]), /429/);
});

test('generateLessonScripts produces one normalized script per variant', async () => {
  const { fetchImpl } = makeFetchStub({ responses: [{ body: buildPayload() }, { body: buildPayload({ hook: 'POV: scope is your friend.' }) }] });
  const client = new DeepSeekClient({ apiKey: 'k', fetchImpl });
  const lesson = normalizeLessonInput({
    topic: 'Closures',
    learningObjective: 'Inner remembers outer',
    keyPoints: ['captures', 'persists', 'fresh per call'],
    durationSeconds: 30,
    variantCount: 2,
  });
  const scripts = await generateLessonScripts(lesson, { client });
  assert.equal(scripts.length, 2);
  for (const script of scripts) {
    assert.ok(script.variantId);
    assert.ok(script.hook);
    assert.ok(script.scenes.length);
    for (const scene of script.scenes) {
      assert.ok(scene.narration);
      assert.ok(scene.brollQuery);
      assert.ok(scene.durationSeconds >= 2 && scene.durationSeconds <= 15);
    }
    const total = script.scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0);
    assert.ok(Math.abs(total - 30) <= 4, `total duration off: ${total}`);
  }
});

test('generateLessonScripts rebalances overlong scene durations', async () => {
  const longScenes = [
    { label: 'hook', narration: 'a', brollQuery: 'x', durationSeconds: 30 },
    { label: 'concept', narration: 'b', brollQuery: 'y', durationSeconds: 30 },
    { label: 'cta', narration: 'c', brollQuery: 'z', durationSeconds: 30 },
  ];
  const { fetchImpl } = makeFetchStub({ responses: [{ body: buildPayload({ scenes: longScenes }) }] });
  const client = new DeepSeekClient({ apiKey: 'k', fetchImpl });
  const lesson = normalizeLessonInput({
    topic: 't',
    learningObjective: 'o',
    keyPoints: ['a'],
    durationSeconds: 30,
    variantCount: 1,
  });
  const [script] = await generateLessonScripts(lesson, { client });
  const total = script.scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0);
  assert.ok(total >= 28 && total <= 32, `expected ~30s after rebalance, got ${total}`);
});
