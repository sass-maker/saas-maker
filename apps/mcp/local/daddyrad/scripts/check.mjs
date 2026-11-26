import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--modules')) {
  throw new Error('Usage: node scripts/check.mjs [--modules <consolidated Modules directory>]');
}
const modules = args.length ? realpathSync(args[1]) : undefined;
const env = { ...process.env };
delete env.DADDYRAD_MODULES_PATH;
let cwd = source;
if (modules) {
  env.DADDYRAD_MODULES_PATH = modules;
  cwd = join(source, '.build', 'consolidated-package');
  mkdirSync(cwd, { recursive: true });
  copyFileSync(join(source, 'Package.swift'), join(cwd, 'Package.swift'));
  for (const name of ['Sources', 'Tests']) {
    if (!existsSync(join(cwd, name))) symlinkSync(join(source, name), join(cwd, name), 'dir');
  }
}
function run(command, args) {
  const result = spawnSync(command, args, { cwd, env, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
const manifest = JSON.parse(readFileSync(new URL('../engine-revisions.json', import.meta.url), 'utf8'));
assert.equal(manifest.schemaVersion, 1);
const expected = ['browserdaddy', 'contextdaddy', 'performancedaddy', 'storagedaddy'];
assert.deepEqual(manifest.engines.map((engine) => engine.directory).sort(), expected);
const pkg = JSON.parse(run('swift', ['package', 'dump-package']));
for (const engine of manifest.engines) {
  assert.equal(engine.repository, `Significant-Hobbies/${engine.directory}`);
  assert.match(engine.revision, /^[a-f0-9]{40}$/);
  if (modules) {
    const dependency = pkg.dependencies.find((entry) => entry.fileSystem?.[0].identity === engine.directory)?.fileSystem[0];
    assert.equal(realpathSync(dependency?.path), realpathSync(join(modules, engine.directory)));
    continue;
  }
  const dependency = pkg.dependencies.find((entry) => entry.sourceControl?.[0]?.identity === engine.directory)?.sourceControl[0];
  assert.ok(dependency, `Missing engine ${engine.directory}`);
  assert.equal(dependency.location.remote[0].urlString, `https://github.com/${engine.repository}.git`);
  assert.equal(dependency.requirement.revision[0], engine.revision);
}
process.stdout.write(run('swift', ['test', '--filter', 'DiagnosticsTests']));
process.stdout.write(run('swift', ['build', '-c', 'release', '--product', 'daddyrad-mcp']));
const bin = run('swift', ['build', '-c', 'release', '--show-bin-path']).trim();
process.stdout.write(run('python3', [join(source, 'scripts/verify-mcp.py'), `${bin}/daddyrad-mcp`]));

console.log(`Verified executable: ${bin}/daddyrad-mcp`);
