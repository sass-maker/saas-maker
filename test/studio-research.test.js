import assert from 'node:assert/strict';
import test from 'node:test';

import { researchKeywords, rankSuggestions } from '../src/studio/keywords.js';
import { fetchTranscript, extractVideoId, parseTimedText, paragraphize } from '../src/studio/transcript.js';

const silent = { warn: () => {} };

test('keyword research returns ranked suggestions from the suggest endpoint', async () => {
  const fetchImpl = async (url) => ({
    ok: true,
    json: async () => {
      const query = decodeURIComponent(url.split('q=')[1]);
      return [query, [`${query} tutorial`, `${query} for beginners`, `best ${query}`]];
    },
  });
  const result = await researchKeywords({ seed: 'sourdough', fetchImpl, logger: silent });
  assert.equal(result.source, 'suggest');
  assert.ok(result.keywords.length >= 3);
  assert.ok(result.keywords.every((k) => typeof k === 'string'));
});

test('keyword research falls back to templates when the endpoint is unreachable', async () => {
  const fetchImpl = async () => { throw new Error('offline'); };
  const result = await researchKeywords({ seed: 'sourdough', fetchImpl, logger: silent });
  assert.equal(result.source, 'template');
  assert.ok(result.keywords.includes('sourdough tutorial'));
});

test('rankSuggestions dedupes and prefers question-style long-tail keywords', () => {
  const ranked = rankSuggestions('coffee', ['coffee', 'coffee', 'how to coffee at home', 'mug']);
  assert.equal(ranked.filter((k) => k === 'coffee').length, 1);
  assert.equal(ranked[0], 'how to coffee at home');
});

test('extractVideoId handles the common url shapes', () => {
  assert.equal(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(extractVideoId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(extractVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(extractVideoId('not a url'), null);
});

test('transcript fetch returns a formatted transcript when captions exist', async () => {
  const watchHtml = 'prefix "captionTracks":[{"baseUrl":"https://captions.example/track?lang=en","languageCode":"en"}] suffix';
  const timedText = [
    '<transcript>',
    '<text start="0.0" dur="2.0">First sentence here.</text>',
    '<text start="2.0" dur="2.0">Second one follows.</text>',
    '<text start="4.0" dur="2.0">Third wraps &amp; closes.</text>',
    '</transcript>',
  ].join('');
  const fetchImpl = async (url) => ({
    ok: true,
    text: async () => (String(url).includes('captions.example') ? timedText : watchHtml),
  });
  const result = await fetchTranscript({ url: 'https://youtu.be/dQw4w9WgXcQ', fetchImpl });
  assert.equal(result.available, true);
  assert.match(result.transcript, /First sentence here\. Second one follows\. Third wraps & closes\./);
  assert.ok(!/start=/.test(result.transcript));
});

test('transcript fetch reports unavailable captions without throwing', async () => {
  const fetchImpl = async () => ({ ok: true, text: async () => '<html>no tracks</html>' });
  const result = await fetchTranscript({ url: 'https://youtu.be/dQw4w9WgXcQ', fetchImpl });
  assert.equal(result.available, false);
  assert.match(result.reason, /caption/);
});

test('parseTimedText and paragraphize produce clean paragraphs', () => {
  const segments = parseTimedText('<text start="0">One.</text><text start="1">Two.</text><text start="2">Three.</text><text start="3">Four.</text><text start="4">Five.</text>');
  assert.equal(segments.length, 5);
  const text = paragraphize(segments, 2);
  assert.equal(text.split('\n\n').length, 3);
});
