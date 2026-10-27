import assert from 'node:assert/strict';
import test from 'node:test';
import { absoluteMarkdownLinks } from './format.mjs';

test('blog links resolve from canonical HTML while code and actual Markdown documents survive', () => {
  const source = '[Homepage](/) [Privacy](/privacy) [Next](../next/) [Part](#part)\n[Guide](/guide.md) [Skill](/SKILL.md)\n`[sample](/private)`\n```md\n[example](/example)\n```\n[ref]: /support "Help"\n';
  const result = absoluteMarkdownLinks(source, 'https://example.com/blog/post/', { htmlPathsByMarkdown: { '/guide.md': '/guide/' } });
  assert.match(result, /\[Homepage\]\(https:\/\/example.com\/\)/);
  assert.match(result, /\[Privacy\]\(https:\/\/example.com\/privacy\)/);
  assert.match(result, /\[Next\]\(https:\/\/example.com\/blog\/next\/\)/);
  assert.match(result, /\[Part\]\(https:\/\/example.com\/blog\/post\/#part\)/);
  assert.match(result, /https:\/\/example.com\/guide\//);
  assert.match(result, /https:\/\/example.com\/SKILL.md/);
  assert.ok(result.includes('`[sample](/private)`'));
  assert.ok(result.includes('```md\n[example](/example)\n```'));
  assert.ok(result.includes('[ref]: https://example.com/support "Help"'));
});

test('explicit same-origin alternates map only with a registered HTML path', () => {
  const result = absoluteMarkdownLinks('[Guide](https://example.com/guide.md?q=1#part) [Remote](https://other.com/guide.md)', 'https://example.com/', { htmlPathsByMarkdown: { '/guide.md': '/guide/' } });
  assert.match(result, /https:\/\/example.com\/guide\/\?q=1#part/);
  assert.match(result, /https:\/\/other.com\/guide.md/);
});

test('source-aware resolver maps repository references without touching code', () => {
  const result = absoluteMarkdownLinks('[Code](../src/main.ts) `[Code](../src/main.ts)`', 'https://example.com/docs/', { resolveLink: (href) => href === '../src/main.ts' ? 'https://github.com/example/repo/blob/main/src/main.ts' : undefined });
  assert.match(result, /\[Code\]\(https:\/\/github.com\/example\/repo\/blob\/main\/src\/main.ts\)/);
  assert.ok(result.endsWith('`[Code](../src/main.ts)`'));
});
