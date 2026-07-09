import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createServer } from '../src/server/index.js';
import { StudioLlm } from '../src/studio/llm.js';
import { IdeaStore } from '../src/studio/idea-store.js';

async function startServer() {
  const scratch = await mkdtemp(path.join(tmpdir(), 'studio-server-'));
  const server = createServer({
    reelStoreOptions: { filePath: path.join(scratch, 'reels.json') },
    lessonStoreOptions: { filePath: path.join(scratch, 'lessons.json') },
    studio: {
      llm: new StudioLlm({ apiKey: '' }),
      ideaStore: new IdeaStore({ filePath: path.join(scratch, 'ideas.json') }),
      facelessOutputDir: path.join(scratch, 'faceless'),
      rendererOptions: { mock: { artifactDir: path.join(scratch, 'renders') } },
      logger: { info: () => {}, warn: () => {} },
    },
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { server, base };
}

test('studio server routes', async (t) => {
  const { server, base } = await startServer();
  t.after(() => server.close());

  await t.test('GET /studio serves the page with all tool panels', async () => {
    const res = await fetch(`${base}/studio`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
    const page = await res.text();
    for (const marker of ['Video ideas', 'Titles', 'Tags', 'Script', 'Keywords', 'Transcript', 'Thumbnails', 'Brand voice', 'Ideas manager', 'Faceless run']) {
      assert.ok(page.includes(marker), `page missing panel: ${marker}`);
    }
  });

  await t.test('POST /studio/titles returns tool output', async () => {
    const res = await fetch(`${base}/studio/titles`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ topic: 'latte art' }),
    });
    assert.equal(res.status, 200);
    const payload = await res.json();
    assert.equal(payload.data.source, 'template');
    assert.ok(payload.data.data.titles.length >= 5);
  });

  await t.test('invalid input returns 400 naming the field', async () => {
    const res = await fetch(`${base}/studio/titles`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
    const payload = await res.json();
    assert.match(payload.error, /topic/);
  });

  await t.test('unknown tool returns 404', async () => {
    const res = await fetch(`${base}/studio/bogus`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 404);
  });

  await t.test('faceless mock run and ideas-list round trip', async () => {
    const res = await fetch(`${base}/studio/faceless`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ topic: 'server smoke topic', engine: 'bogus-engine' }),
    });
    assert.equal(res.status, 200);
    const payload = await res.json();
    assert.equal(payload.data.engine, 'mock');
    assert.equal(payload.data.renderStatus, 'completed');
    assert.equal(payload.data.postHandoff, null);

    const listRes = await fetch(`${base}/studio/ideas-list`);
    assert.equal(listRes.status, 200);
    const list = await listRes.json();
    assert.ok(list.data.some((idea) => idea.title === 'server smoke topic'));
  });

  await t.test('idea status update via POST /studio/status', async () => {
    const listRes = await fetch(`${base}/studio/ideas-list`);
    const list = await listRes.json();
    const idea = list.data[0];
    const res = await fetch(`${base}/studio/status`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: idea.id, to: 'posted' }),
    });
    assert.equal(res.status, 200);
    const payload = await res.json();
    assert.equal(payload.data.status, 'posted');
  });
});
