import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ChannelRoutingProvider } from '../src/posting.js';

function stubProvider(label) {
  const calls = [];
  return {
    label,
    calls,
    post: async (post) => {
      calls.push(post);
      return {
        provider: label,
        status: 'posted',
        channel: post.channel,
        assetUrl: post.asset_url,
        externalUrl: `https://${label}/x`,
        postedAt: '2026-06-16T12:00:00Z',
      };
    },
  };
}

test('ChannelRoutingProvider sends youtube_shorts to youtubeProvider', async () => {
  const yt = stubProvider('youtube');
  const ig = stubProvider('instagram');
  const router = new ChannelRoutingProvider({ youtubeProvider: yt, instagramProvider: ig });
  await router.post({ id: 'a', channel: 'youtube_shorts' });
  assert.equal(yt.calls.length, 1);
  assert.equal(ig.calls.length, 0);
});

test('ChannelRoutingProvider sends instagram_reels to instagramProvider', async () => {
  const yt = stubProvider('youtube');
  const ig = stubProvider('instagram');
  const router = new ChannelRoutingProvider({ youtubeProvider: yt, instagramProvider: ig });
  await router.post({ id: 'a', channel: 'instagram_reels' });
  assert.equal(yt.calls.length, 0);
  assert.equal(ig.calls.length, 1);
});

test('ChannelRoutingProvider falls back to manual for unknown channels', async () => {
  const yt = stubProvider('youtube');
  const ig = stubProvider('instagram');
  const router = new ChannelRoutingProvider({ youtubeProvider: yt, instagramProvider: ig });
  const result = await router.post({ id: 'a', channel: 'tiktok', title: 't', result_url: 'https://x/y.mp4' });
  assert.equal(yt.calls.length, 0);
  assert.equal(ig.calls.length, 0);
  assert.equal(result.provider, 'manual');
});

test('ChannelRoutingProvider falls back to manual when a channel has no provider configured', async () => {
  const yt = stubProvider('youtube');
  const router = new ChannelRoutingProvider({ youtubeProvider: yt });
  const result = await router.post({ id: 'a', channel: 'instagram_reels', title: 't', result_url: 'https://x/y.mp4' });
  assert.equal(yt.calls.length, 0);
  assert.equal(result.provider, 'manual');
});

test('ChannelRoutingProvider honors an explicit custom fallback provider', async () => {
  const custom = stubProvider('custom-fallback');
  const router = new ChannelRoutingProvider({ fallback: custom });
  await router.post({ id: 'a', channel: 'tiktok' });
  assert.equal(custom.calls.length, 1);
});
