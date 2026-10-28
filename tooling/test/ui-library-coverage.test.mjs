import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectSource, collectCoverage } from '../scripts/ui-library-coverage.mjs';

test('an installed or unused library earns no credit; aliases and namespaces do', () => {
  const source = `import { Button as Action, Card, CardContent } from '@saas-maker/ui/components/button';
import * as UI from '@saas-maker/ui/components/input';
export const Page = () => <Card><CardContent><Action>Save</Action><UI.Input/><button>Cancel</button></CardContent></Card>;`;
  const result = inspectSource(source, 'Page.tsx');
  assert.equal(result.shared.length, 3); assert.equal(result.bespoke.length, 1);
  assert.equal(inspectSource(`import { Button } from '@saas-maker/ui/components/button'; const unused = 1;`, 'Page.tsx').shared.length, 0);
});
test('comments and source strings do not manufacture component usage', () => {
  const source = `// <Button>fake</Button>
const sample = "<button>fake</button>";
/* <input/> */
export const Page = () => <><p>Don't count punctuation as code.</p><button onClick={() => { const x = '<input/>'; }}>Real</button></>;`;
  const result = inspectSource(source, 'Page.tsx'); assert.equal(result.bespoke.length, 1);
});
test('Astro frontmatter and scripts are excluded while actual markup is counted', () => {
  const source = `---
import { Button } from '@saas-maker/ui/components/button';
const example = '<button>fake</button>';
---
<Button>Action</Button><input/><script>const x='<textarea/>';</script><!-- <button/> -->`;
  const result = inspectSource(source, 'index.astro'); assert.equal(result.shared.length, 1); assert.equal(result.bespoke.length, 1);
});
test('native components and applied style count, tokens and imports alone do not', () => {
  const result = inspectSource(`import SaaSMakerUI
let label = "Button(fake)"
SMCard { Button("Save") {}.buttonStyle(SMButtonStyle()) }
TextField("Name", text: $name)
// Button("fake")
`, 'View.swift');
  assert.equal(result.shared.length, 2); assert.equal(result.bespoke.length, 1);
  assert.equal(inspectSource('import SaaSMakerUI', 'View.swift').shared.length, 0);
});
test('unknown local custom controls enter the denominator without shared credit', () => {
  const result = inspectSource('export const Page=()=> <><PrimaryButton/><ChartCanvas/><CustomCard/></>;', 'Page.tsx');
  assert.equal(result.shared.length, 0); assert.equal(result.bespoke.length, 2);
});
test('missing checkout remains unknown and malformed manifests fail closed', () => {
  const result = collectCoverage({ schemaVersion: 1, projects: [{ id: 'demo', root: '/nonexistent/ui-coverage-fixture' }] });
  assert.equal(result.records.demo.percent, null); assert.equal(result.records.demo.status, 'unavailable');
  assert.throws(() => collectCoverage({ schemaVersion: 1, projects: [{ id: 'demo', root: '/tmp', prefix: '../private' }] }), /Invalid/);
  assert.throws(() => collectCoverage({ schemaVersion: 1, projects: [], unexpected: true }), /Invalid/);
});

test('shared footer and templates are reported separately, never as full control coverage', () => {
  const result = inspectSource(`import { GalleryPage } from '@saas-maker/templates';
import { StudioFooter } from '@saas-maker/ui/blocks/footer';
export const Page=()=> <GalleryPage><StudioFooter/></GalleryPage>;`, 'Page.tsx');
  assert.equal(result.shared.length, 0); assert.equal(result.bespoke.length, 0); assert.equal(result.blocks.length, 2);
});
