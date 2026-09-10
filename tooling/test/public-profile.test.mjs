import test from 'node:test';
import assert from 'node:assert/strict';
import { START, END, renderProjectSection, updateReadme } from '../scripts/public-profile.mjs';

const project = { id: 'example', name: 'Example', description: 'A useful experiment.', url: 'https://example.com', group: 'past', shareable: true };
const catalog = { schemaVersion: 5, directory: [project] };

test('refresh preserves personal prose and is idempotent', () => {
  const before = `# Person\n\nBiography.\n\n${START}\nold projects\n${END}\n\n## Writing\nMy essay.\n`;
  const after = updateReadme(before, catalog);
  assert.ok(after.startsWith('# Person\n\nBiography.\n\n'));
  assert.ok(after.endsWith('\n\n## Writing\nMy essay.\n'));
  assert.match(after, /Past work and experiments/);
  assert.equal(updateReadme(after, catalog), after);
});

test('explicit initialization replaces only Start here', () => {
  const before = '# Person\n\n## Start here\n\n- Retired project\n\n## Writing\nEssay\n';
  assert.throws(() => updateReadme(before, catalog));
  const after = updateReadme(before, catalog, true);
  assert.ok(after.startsWith('# Person\n\n'));
  assert.ok(after.endsWith('## Writing\nEssay\n'));
  assert.ok(!after.includes('Retired project'));
});

test('invalid inputs cannot replace the previous good section', () => {
  for (const directory of [[], [project, project], [{ ...project, shareable: false }], [{ ...project, url: 'javascript:alert(1)' }]]) {
    assert.throws(() => renderProjectSection({ schemaVersion: 5, directory }));
  }
  assert.throws(() => updateReadme(`${START}${START}${END}`, catalog));
  assert.throws(() => updateReadme(`${END}${START}`, catalog));
});

test('metadata cannot inject Markdown or HTML', () => {
  const rendered = renderProjectSection({ schemaVersion: 5, directory: [{ ...project, name: '<script>[bad]', description: 'line\n# heading' }] });
  assert.ok(!rendered.includes('<script>'));
  assert.ok(rendered.includes('\\[bad\\]'));
  assert.ok(rendered.includes('line \\# heading'));
});
