import assert from 'node:assert/strict';
import test from 'node:test';

import { FndSaaSMakerClient } from '../src/saas-maker-client.js';

test('Fnd SaaS Maker client uses stored CLI session without exposing a token', async () => {
  const calls = [];
  const client = new FndSaaSMakerClient({
    fndBin: '/fleet/fnd',
    fndArgsPrefix: [],
    execFileImpl: async (command, args) => {
      calls.push({ command, args });
      return { stdout: `GET https://api.sassmaker.com\nHTTP 200\n${JSON.stringify({ data: [{ id: 'post-1' }] })}` };
    },
  });
  const posts = await client.listMarketingPosts({ status: 'accepted', limit: 5 });
  await client.createMarketingPost({ title: 'Title', body: 'Body' });
  await client.updateMarketingPost('post-1', { notes: 'updated' });
  assert.equal(posts[0].id, 'post-1');
  assert.equal(calls.length, 3);
  assert.equal(calls.every((call) => call.args.includes('--auth') && call.args.includes('session')), true);
  assert.equal(calls.flatMap((call) => call.args).some((arg) => String(arg).startsWith('sm_')), false);
});
