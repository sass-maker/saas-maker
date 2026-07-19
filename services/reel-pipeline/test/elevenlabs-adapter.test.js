import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { ElevenLabsClient, synthesizeSceneAudio } from '../src/adapters/elevenlabs.js';

function fakeFetch({ ok = true, status = 200, body = Buffer.from('mp3-bytes') } = {}) {
  const calls = [];
  return {
    calls,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return {
        ok,
        status,
        arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
        text: async () => body.toString('utf8'),
      };
    },
  };
}

test('synthesize posts to ElevenLabs with voice + model + key', async () => {
  const { fetchImpl, calls } = fakeFetch();
  const client = new ElevenLabsClient({ apiKey: 'k', voiceId: 'voice_abc', fetchImpl });
  const audio = await client.synthesize('hello world');
  assert.ok(Buffer.isBuffer(audio));
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /v1\/text-to-speech\/voice_abc\?output_format=/);
  assert.equal(calls[0].init.headers['xi-api-key'], 'k');
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.text, 'hello world');
  assert.equal(body.model_id, 'eleven_turbo_v2_5');
  assert.equal(body.voice_settings.use_speaker_boost, true);
});

test('synthesize requires api key and voice id', async () => {
  const { fetchImpl } = fakeFetch();
  const noKey = new ElevenLabsClient({ fetchImpl });
  await assert.rejects(noKey.synthesize('x'), /ELEVENLABS_API_KEY/);
  const noVoice = new ElevenLabsClient({ apiKey: 'k', fetchImpl });
  await assert.rejects(noVoice.synthesize('x'), /ELEVENLABS_VOICE_ID/);
});

test('synthesize surfaces non-2xx', async () => {
  const { fetchImpl } = fakeFetch({ ok: false, status: 401, body: Buffer.from('unauthorized') });
  const client = new ElevenLabsClient({ apiKey: 'k', voiceId: 'v', fetchImpl });
  await assert.rejects(client.synthesize('x'), /401/);
});

test('synthesizeSceneAudio writes one mp3 per scene with narration', async () => {
  const { fetchImpl } = fakeFetch();
  const client = new ElevenLabsClient({ apiKey: 'k', voiceId: 'v', fetchImpl });
  const dir = await mkdtemp(path.join(tmpdir(), 'el-audio-'));
  try {
    const scenes = [
      { label: 'hook', narration: 'one', brollQuery: 'x', durationSeconds: 4 },
      { label: 'concept', narration: '', brollQuery: 'y', durationSeconds: 4 },
      { label: 'cta', narration: 'three', brollQuery: 'z', durationSeconds: 4 },
    ];
    const results = await synthesizeSceneAudio(scenes, { client, outputDir: dir });
    assert.equal(results.length, 3);
    assert.ok(results[0].path?.endsWith('scene-01.mp3'));
    assert.equal(results[1].path, null);
    assert.ok(results[2].path?.endsWith('scene-03.mp3'));
    const files = await readdir(dir);
    assert.deepEqual(files.sort(), ['scene-01.mp3', 'scene-03.mp3']);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
