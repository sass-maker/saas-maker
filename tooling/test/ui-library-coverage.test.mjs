import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { inspectSource, collectCoverage, scanRepository } from '../scripts/ui-library-coverage.mjs';

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
  assert.equal(result.shared[0].line, 5); assert.equal(result.bespoke[0].line, 5);
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
test('unrecognised custom control names remain outside the identified-control metric', () => {
  const result = inspectSource('export const Page=()=> <><PrimaryButton/><ChartCanvas/><CustomCard/></>;', 'Page.tsx');
  assert.equal(result.shared.length, 0); assert.equal(result.bespoke.length, 0);
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
test('semicolon-free imports cannot take names from earlier non-library imports', () => {
  const positive = inspectSource(`import { useState } from 'react'\nimport { Button } from '@saas-maker/ui/components/button'\nexport const P=()=> <Button/>`, 'Page.tsx');
  assert.equal(positive.shared.length, 1); assert.equal(positive.bespoke.length, 0);
  const inverse = inspectSource(`import { Button } from './b'\nimport { Card } from '@saas-maker/ui/components/card'\nexport const P=()=> <Card><Button/></Card>`, 'Page.tsx');
  assert.equal(inverse.shared[0].name, 'Card'); assert.equal(inverse.bespoke[0].name, 'Button');
});
test('generic types and comparison expressions are not JSX', () => {
  const result = inspectSource(`useState<Card | null>(null);\nconst sample="<button>fake</button>";\nconst comparison=x<Card;\nexport const P=()=> <div/>`, 'Page.tsx');
  assert.equal(result.shared.length, 0); assert.equal(result.bespoke.length, 0);
});
test('local block and child-part names do not inflate the control denominator', () => {
  const result = inspectSource(`import { Button } from '@saas-maker/ui/components/button';\nexport const P=()=> <><Button/><SiteFooter/><LocalAppShell/><Card><CardFooter/></Card></>`, 'Page.tsx');
  assert.equal(result.shared.length, 1); assert.deepEqual(result.bespoke.map(x=>x.name), ['Card']);
});
test('display labels inside native shared-styled buttons are not extra controls', () => {
  const result = inspectSource('import SaaSMakerUI\nButton {} label: { Label("Go", systemImage:"g") }.buttonStyle(SMButtonStyle())', 'View.swift');
  assert.equal(result.shared.length, 1); assert.equal(result.bespoke.length, 0);
});
test('scans committed main rather than dirty source and normalizes prefixes; invalid roots stay explicit', () => {
  const root = mkdtempSync(join(tmpdir(), 'ui-coverage-test-'));
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  git('init', '-b', 'main'); mkdirSync(join(root, 'ui')); writeFileSync(join(root, 'ui/Page.tsx'), `import { Button } from '@saas-maker/ui/components/button';\nexport const P=()=> <Button/>;`);
  mkdirSync(join(root, 'server')); writeFileSync(join(root, 'server/worker.ts'), 'const html=`<!doctype html><html><body><a href="/">Read</a></body></html>`;');
  git('add', 'ui/Page.tsx', 'server/worker.ts'); git('-c', 'user.name=Coverage Test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'fixture'); git('update-ref', 'refs/remotes/origin/main', 'HEAD');
  writeFileSync(join(root, 'ui/Page.tsx'), 'export const P=()=> <input/>;');
  const result = scanRepository(root, { prefix: 'ui/' }); assert.equal(result.shared, 1); assert.equal(result.eligible, 1); assert.equal(result.dirty, false); assert.equal(result.sourceRef, 'origin/main');
  assert.equal(scanRepository(root, { prefix: './ui' }).shared, 1);
  const informational=scanRepository(root,{prefix:'server'}); assert.equal(informational.status,'no-eligible-controls'); assert.equal(informational.percent,null); assert.equal(informational.surfaces[0].files[0].documents,1);
  assert.throws(() => scanRepository(root, { prefix: 'missing' }), /Prefix not found/);
  assert.throws(() => scanRepository(join(root, 'ui')), /repository root/);
  const invalid = collectCoverage({ schemaVersion: 1, projects: [{ id: 'nested', root: join(root, 'ui') }] }); assert.equal(invalid.records.nested.status, 'scan-failed');
});
test('the same supported root families and child parts have symmetric denominators', () => {
  const names = ['Calendar', 'Alert', 'Separator', 'RadioGroup', 'Sidebar'];
  const jsx = '<><Calendar/><Alert/><Separator/><RadioGroup/><Sidebar><SidebarMenu><SidebarMenuButton/></SidebarMenu></Sidebar></>';
  const shared = inspectSource(`import { ${names.join(', ')}, SidebarMenu, SidebarMenuButton } from '@saas-maker/ui';\nexport default ${jsx}`, 'P.tsx');
  const local = inspectSource(`import { ${names.join(', ')}, SidebarMenu, SidebarMenuButton } from './ui';\nexport default ${jsx}`, 'P.tsx');
  assert.equal(shared.shared.length, 5); assert.equal(local.bespoke.length, 5);
});
test('generic arrows do not corrupt later strings and comments do not hide real JSX roots', () => {
  const generic = inspectSource('const f = <T extends unknown>(x:T)=>x;\nconst s="<button>fake</button>";', 'P.tsx');
  assert.equal(generic.bespoke.length, 0);
  const jsx = inspectSource("import { Card } from '@saas-maker/ui';\nexport const P=()=> { return (\n // primary panel\n <Card/>\n); }", 'P.tsx');
  assert.equal(jsx.shared.length, 1);
});
test('comments inside named import lists cannot invert component attribution', () => {
  const result = inspectSource("import {\n Button, // primary\n Card,\n} from '@saas-maker/ui';\nexport default <Card><Button/></Card>", 'P.tsx');
  assert.equal(result.shared.length, 2); assert.equal(result.bespoke.length, 0);
  assert.throws(() => collectCoverage({ schemaVersion: 1, projects: [{ id: 'a', root: '/tmp', prefix: null }] }), /Invalid/);
  assert.throws(() => collectCoverage({ schemaVersion: 1, projects: [{ id: 'a', root: '/tmp', excludePrefixes: null }] }), /Invalid/);
});

test('root-suffixed parts, primitive internals and nested generic types do not manufacture control calls', () => {
  const parts = inspectSource('export default <><BreadcrumbSeparator/><SidebarSeparator/><CalendarDayButton/><SelectPrimitive.Separator/></>', 'P.tsx');
  assert.equal(parts.bespoke.length, 0);
  const generic = inspectSource('const f = <T extends Record<string, unknown>>(x:T)=>x;\nconst s="<button>fake</button>";', 'P.tsx');
  assert.equal(generic.bespoke.length, 0);
  const copy = inspectSource("import { Card } from '@saas-maker/ui';\nexport const P=()=>{if(x) return <p>Don't</p>; return (\n // it's the primary panel\n <Card/>);}", 'P.tsx');
  assert.equal(copy.shared.length, 1);
});


test('server HTML documents retain lines, exclude scripts and interpolations, and separate footer calls', () => {
  const source = [
    "import { renderStudioFooterHtml as footer } from '@saas-maker/ui/footer-html';",
    'const sample = "<button>fake</button>";',
    'const ignored = `<button>fragment outside supported documents</button>`;',
    'const html = `<!doctype html><html><body>',
    '<button>Actual</button>${condition ? "<input/>" : `${nested}`}',
    '<script>const sample="<textarea/>";</script>',
    '${footer({ product: "Example" })}</body></html>`;',
    'const sharedFooter = footer({ product: "Example" });',
  ].join('\n');
  const result = inspectSource(source, 'src/worker.ts');
  assert.equal(result.documents, 1); assert.deepEqual(result.bespoke, [{ name: 'button', line: 5 }]);
  // The standalone renderer is a block; interpolated code is excluded from static markup.
  assert.deepEqual(result.blocks, [{ name: 'renderStudioFooterHtml', line: 8 }]);
  const plain = inspectSource('const s = `<!doctype html><html><body><a href="/">Read</a></body></html>`;', 'server.js');
  assert.equal(plain.documents, 1); assert.equal(plain.bespoke.length, 0);
  assert.equal(inspectSource('const s = tag`<html><button/></html>`;', 'server.ts').documents, 0);
  assert.equal(inspectSource('// `<!doctype html><html><button/></html>`', 'server.ts').documents, 0);
});

test('footer renderer and its custom-element wrapper count as one block', () => {
  const source = "import { renderStudioFooterHtml } from '@saas-maker/ui/footer-html';\nconst footer=renderStudioFooterHtml({});\nconst html=`<html><body><studio-footer>${footer}</studio-footer></body></html>`;";
  const result=inspectSource(source,'worker.ts'); assert.equal(result.blocks.length,1); assert.equal(result.blocks[0].name,'studio-footer');
});
