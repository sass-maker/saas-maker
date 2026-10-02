#!/usr/bin/env node

// Score rendered websites locally with pinned slop-detect rules and evidence.
// Upstream owns extraction/scoring; Fleet owns provenance
// and distinguishes failed scans from advisory findings.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const revision = 'cdd58e1d249ae39616d94950d6ea232ec7b0b378';
const checkout = path.join(
  process.env.XDG_DATA_HOME || path.join(homedir(), '.local/share'),
  'fleet-tools/slop-detect', revision,
);
const cli = path.join(checkout, 'packages/cli/dist/bin/slop.js');
const args = process.argv.slice(2);

function run(command, argv, cwd = checkout) {
  const result = spawnSync(command, argv, { cwd, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status ?? result.signal})`);
}

function verifyRevision() {
  const result = spawnSync('git', ['-C', checkout, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
  if (result.status !== 0 || result.stdout.trim() !== revision) {
    throw new Error('Local slop-detect checkout does not match the reviewed revision.');
  }
}

try {
  if (args.length === 0 || args.includes('--help')) {
    console.log(`Usage:
  node slop-score.mjs setup
  node slop-score.mjs <http(s)-url> [more urls] [--copy] [--preset full|strict|marketing|minimal]
                     [--design-md <local-file>] [--timeout <milliseconds>] [--json]

JSON output is always emitted. Scores are advisory; lower design slop is better.
The browser runs locally at upstream's fixed 1280x800 viewport.
Setup installs the pinned public source and its browser in the user's local cache.
`);
  } else if (args[0] === 'setup' && args.length === 1) {
    if (!existsSync(checkout)) {
      // Fetch the exact public commit, without following a moving release tag.
      run('git', ['init', '--quiet', checkout], homedir());
      run('git', ['remote', 'add', 'origin', 'https://github.com/ravidsrk/slop-detect.git']);
      run('git', ['fetch', '--depth', '1', 'origin', revision]);
      run('git', ['checkout', '--detach', 'FETCH_HEAD']);
    }
    verifyRevision();
    run('bun', ['install', '--frozen-lockfile', '--ignore-scripts',
      '--filter', 'slop-detect-monorepo', '--filter', '@slop-detect/core', '--filter', 'slop-detect']);
    run('bun', ['run', '--filter', '@slop-detect/core', 'build']);
    run('bun', ['run', '--filter', 'slop-detect', 'build']);
    run(process.execPath, ['node_modules/playwright/cli.js', 'install', 'chromium'],
      path.join(checkout, 'packages/cli'));
    console.log(`Ready: slop-detect 0.8.0 at ${revision}`);
  } else {
    // Avoid forwarding options that submit URLs/design context to the hosted
    // API, embed screenshots, or turn taste heuristics into a failing gate.
    const urls = [];
    const options = { preset: 'full', axes: ['design'] };
    for (let i = 0; i < args.length; i += 1) {
      const arg = args[i];
      if (arg === '--json') continue;
      else if (arg === '--copy') options.axes = ['design', 'copy'];
      else if (['--preset', '--design-md', '--timeout'].includes(arg)) {
        const value = args[++i];
        if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value.`);
        if (arg === '--design-md' && (value === 'auto' || /^https?:/i.test(value))) {
          throw new Error('--design-md accepts a local file only in this runner.');
        }
        if (arg === '--preset') options.preset = value;
        else if (arg === '--design-md') options.designMd = readFileSync(value, 'utf8');
        else {
          options.timeout = Number(value);
          if (!Number.isInteger(options.timeout) || options.timeout <= 0) {
            throw new Error('--timeout requires a positive integer.');
          }
        }
      } else if (/^https?:\/\//i.test(arg)) {
        const url = new URL(arg);
        if (url.username || url.password) throw new Error('URLs with embedded credentials are unsupported.');
        urls.push(arg);
      } else throw new Error(`Unsupported argument: ${arg}. See --help.`);
    }
    if (!urls.length) throw new Error('Provide at least one http(s) URL.');
    if (!existsSync(cli)) throw new Error('Run slop-score.mjs setup first.');
    verifyRevision();
    const { isPreset } = await import(pathToFileURL(path.join(checkout, 'packages/core/dist/index.js')));
    if (!isPreset(options.preset)) throw new Error(`Unknown preset: ${options.preset}.`);
    // Call the upstream library directly: its CLI process.exit() can truncate
    // large JSON reports written to pipes. Natural process exit flushes stdout.
    process.env.SKIP_PLAYWRIGHT_DOWNLOAD = '1';
    const { scanUrl } = await import(pathToFileURL(path.join(checkout, 'packages/cli/dist/index.js')));
    const results = [];
    for (const url of urls) {
      try { results.push(await scanUrl(url, options)); }
      catch (error) { results.push({ url, error: error.message }); }
    }
    const failed = results.some((r) => r.error || r.blocked || r.patternsErrored > 0
      || !Number.isFinite(r.score) || !r.definitionsVersion || !Array.isArray(r.patterns));
    console.log(JSON.stringify({
      tool: { name: 'slop-detect', version: '0.8.0', revision },
      measuredAt: new Date().toISOString(),
      viewport: { width: 1280, height: 800 },
      posture: 'advisory', status: failed ? 'scan-failed' : 'scanned', results,
    }, null, 2));
    process.exitCode = failed ? 1 : 0;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
