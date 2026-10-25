import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const launcher = resolve(import.meta.dirname, '../skills/launch-campaign/scripts/fortress-mcp.sh');
const removed = [
  'TILION_BASE_URL', 'TILLION_BASE_URL', 'TILION_API_KEY', 'TILLION_API_KEY',
  'TILION_PROXY', 'TILLION_PROXY', 'CAPTCHA_API_KEY', 'CAPTCHA_PROVIDER',
  'TILLION_CAPTCHA_CHAIN', 'TILLION_CAPTCHA_KEY', 'TILLION_UNLOCKER_KEY',
  'TILLION_BRIGHTDATA_API_KEY', 'TILLION_BRIGHTDATA_ZONE',
  'TILION_CAPTCHA_CHAIN', 'TILION_CAPTCHA_KEY', 'TILION_FUTURE_SERVICE',
  'TURING_ENDPOINT', 'TURING_KEY', 'TILLION_LICENSE_KEY',
  'FORTRESS_REPO', 'FORTRESS_TAG', 'FORTRESS_BROWSERS_PATH', 'FORTRESS_DOWNLOAD_HOST',
  'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY',
  'http_proxy', 'https_proxy', 'all_proxy', 'no_proxy',
];
const enforced = {
  TILION_SELFHEAL: '0', TILLION_SELFHEAL_ENABLED: '0', TILLION_CAPTCHA_PROVIDER: 'none',
  TILION_MCP_PREWARM: '0', TILLION_MCP_PREWARM: '0',
  TILION_MCP_HEADLESS: '1', TILLION_MCP_HEADLESS: '1',
  TILION_ALLOW_PRIVATE_EGRESS: '0', TILLION_ALLOW_PRIVATE_EGRESS: '0',
  TILION_MCP_ALLOW_ANY_PATH: '0', TILLION_MCP_ALLOW_ANY_PATH: '0',
};

function withRuntime(source, run) {
  const dir = mkdtempSync(join(tmpdir(), 'fortress-launcher-'));
  try {
    if (source) {
      const binary = join(dir, 'uvx');
      writeFileSync(binary, `#!${process.execPath}\n${source}\n`);
      chmodSync(binary, 0o755);
    }
    run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('Fortress launcher pins its runtime and overrides inherited service settings', () => {
  withRuntime('console.log(JSON.stringify({ args: process.argv.slice(2), env: process.env }));', (dir) => {
    const inherited = Object.fromEntries([...removed, ...Object.keys(enforced)].map((key) => [key, 'inherited-test-value']));
    const result = spawnSync('/bin/bash', [launcher], {
      env: {
        PATH: `${dir}:/usr/bin:/bin`, ...inherited,
        TILION_LICENSE_KEY: 'test-license-value',
      }, encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    const observed = JSON.parse(result.stdout);
    assert.deepEqual(observed.args, [
      '--python', '3.12', '--from', 'tilion[mcp]==0.1.16',
      '--with', 'tilion-fortress==153.0.8010.36.post1', 'tilion-mcp',
    ]);
    for (const key of removed) assert.equal(observed.env[key], undefined, key);
    for (const [key, value] of Object.entries(enforced)) assert.equal(observed.env[key], value, key);
    assert.equal(observed.env.TILION_LICENSE_KEY, 'test-license-value');
    assert.match(observed.env.TILION_MCP_WRITE_DIR, /fortress-directory\.[^/]+$/);
    const second = spawnSync('/bin/bash', [launcher], {
      env: { PATH: `${dir}:/usr/bin:/bin` }, encoding: 'utf8',
    });
    assert.equal(second.status, 0, second.stderr);
    assert.notEqual(JSON.parse(second.stdout).env.TILION_MCP_WRITE_DIR, observed.env.TILION_MCP_WRITE_DIR);
  });
});

test('Fortress launcher reports missing uv without starting a browser', () => {
  withRuntime(null, (dir) => {
    const result = spawnSync('/bin/bash', [launcher], { env: { PATH: dir }, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /requires uv/);
    assert.equal(result.stdout, '');
  });
});

test('Fortress launcher propagates runtime startup failure', () => {
  withRuntime('process.exit(41);', (dir) => {
    const result = spawnSync('/bin/bash', [launcher], { env: { PATH: `${dir}:/usr/bin:/bin` }, encoding: 'utf8' });
    assert.equal(result.status, 41);
  });
});
