import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// We test forge functions directly using real temp directories so that
// the file-existence logic (detectPackageManager, lockfile checks) is exercised
// against real fs state without brittle mocks.

import {
  detectPackageManager,
  scaffoldHusky,
  scaffoldCI,
  buildPrePushTemplate,
} from '../../packages/cli/src/lib/forge.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'forge-test-'));
  // Place a package.json so scaffoldHusky/scaffoldCI don't skip
  writeFileSync(
    join(tmpDir, 'package.json'),
    JSON.stringify({ name: 'test', scripts: { lint: 'echo ok' } })
  );
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// detectPackageManager
// ---------------------------------------------------------------------------

describe('detectPackageManager', () => {
  it('detects bun via bun.lock', () => {
    writeFileSync(join(tmpDir, 'bun.lock'), '');
    expect(detectPackageManager(tmpDir)).toBe('bun');
  });

  it('detects bun via bun.lockb', () => {
    writeFileSync(join(tmpDir, 'bun.lockb'), '');
    expect(detectPackageManager(tmpDir)).toBe('bun');
  });

  it('detects pnpm via pnpm-lock.yaml', () => {
    writeFileSync(join(tmpDir, 'pnpm-lock.yaml'), '');
    expect(detectPackageManager(tmpDir)).toBe('pnpm');
  });

  it('detects npm via package-lock.json', () => {
    writeFileSync(join(tmpDir, 'package-lock.json'), '');
    expect(detectPackageManager(tmpDir)).toBe('npm');
  });

  it('detects yarn via yarn.lock', () => {
    writeFileSync(join(tmpDir, 'yarn.lock'), '');
    expect(detectPackageManager(tmpDir)).toBe('yarn');
  });

  it('defaults to pnpm when no lockfile present', () => {
    expect(detectPackageManager(tmpDir)).toBe('pnpm');
  });

  it('prefers bun over pnpm when both lockfiles present', () => {
    writeFileSync(join(tmpDir, 'bun.lock'), '');
    writeFileSync(join(tmpDir, 'pnpm-lock.yaml'), '');
    expect(detectPackageManager(tmpDir)).toBe('bun');
  });

  it('prefers pnpm over npm when both lockfiles present', () => {
    writeFileSync(join(tmpDir, 'pnpm-lock.yaml'), '');
    writeFileSync(join(tmpDir, 'package-lock.json'), '');
    expect(detectPackageManager(tmpDir)).toBe('pnpm');
  });
});

// ---------------------------------------------------------------------------
// buildPrePushTemplate
// ---------------------------------------------------------------------------

describe('buildPrePushTemplate', () => {
  it('uses pnpm run lint --if-present for pnpm', () => {
    const tmpl = buildPrePushTemplate('pnpm');
    expect(tmpl).toContain('pnpm run lint --if-present');
    expect(tmpl).toContain('SECRETS');
  });

  it('uses bun run lint for bun', () => {
    const tmpl = buildPrePushTemplate('bun');
    expect(tmpl).toContain('bun run lint');
    expect(tmpl).not.toContain('--if-present');
    expect(tmpl).toContain('SECRETS');
  });

  it('uses npm run lint for npm', () => {
    const tmpl = buildPrePushTemplate('npm');
    expect(tmpl).toContain('npm run lint');
    expect(tmpl).not.toContain('--if-present');
    expect(tmpl).toContain('SECRETS');
  });

  it('uses yarn lint for yarn', () => {
    const tmpl = buildPrePushTemplate('yarn');
    expect(tmpl).toContain('yarn lint');
    expect(tmpl).not.toContain('--if-present');
    expect(tmpl).toContain('SECRETS');
  });

  it('starts with shebang', () => {
    for (const pm of ['bun', 'pnpm', 'npm', 'yarn'] as const) {
      expect(buildPrePushTemplate(pm)).toMatch(/^#!\/bin\/sh/);
    }
  });
});

// ---------------------------------------------------------------------------
// scaffoldHusky
// ---------------------------------------------------------------------------

describe('scaffoldHusky', () => {
  it('writes bun run lint for bun repo', () => {
    writeFileSync(join(tmpDir, 'bun.lock'), '');
    scaffoldHusky(tmpDir);
    const content = readFileSync(join(tmpDir, '.husky', 'pre-push'), 'utf-8');
    expect(content).toContain('bun run lint');
    expect(content).not.toContain('pnpm run lint');
  });

  it('writes pnpm run lint --if-present for pnpm repo', () => {
    writeFileSync(join(tmpDir, 'pnpm-lock.yaml'), '');
    scaffoldHusky(tmpDir);
    const content = readFileSync(join(tmpDir, '.husky', 'pre-push'), 'utf-8');
    expect(content).toContain('pnpm run lint --if-present');
  });

  it('writes npm run lint for npm repo', () => {
    writeFileSync(join(tmpDir, 'package-lock.json'), '');
    scaffoldHusky(tmpDir);
    const content = readFileSync(join(tmpDir, '.husky', 'pre-push'), 'utf-8');
    expect(content).toContain('npm run lint');
    expect(content).not.toContain('--if-present');
  });

  it('writes yarn lint for yarn repo', () => {
    writeFileSync(join(tmpDir, 'yarn.lock'), '');
    scaffoldHusky(tmpDir);
    const content = readFileSync(join(tmpDir, '.husky', 'pre-push'), 'utf-8');
    expect(content).toContain('yarn lint');
    expect(content).not.toContain('--if-present');
  });

  it('does not overwrite existing pre-push without --force', () => {
    const huskyDir = join(tmpDir, '.husky');
    mkdirSync(huskyDir);
    writeFileSync(join(huskyDir, 'pre-push'), '#!/bin/sh\necho existing\n');
    scaffoldHusky(tmpDir);
    const content = readFileSync(join(huskyDir, 'pre-push'), 'utf-8');
    expect(content).toContain('existing');
  });

  it('overwrites existing pre-push with --force', () => {
    writeFileSync(join(tmpDir, 'pnpm-lock.yaml'), '');
    const huskyDir = join(tmpDir, '.husky');
    mkdirSync(huskyDir);
    writeFileSync(join(huskyDir, 'pre-push'), '#!/bin/sh\necho existing\n');
    scaffoldHusky(tmpDir, { force: true });
    const content = readFileSync(join(huskyDir, 'pre-push'), 'utf-8');
    expect(content).not.toContain('existing');
    expect(content).toContain('pnpm run lint');
  });

  it('secret scan is always present regardless of PM', () => {
    for (const lockfile of ['bun.lock', 'pnpm-lock.yaml', 'package-lock.json', 'yarn.lock']) {
      const dir = mkdtempSync(join(tmpdir(), 'forge-pm-'));
      writeFileSync(join(dir, 'package.json'), '{}');
      writeFileSync(join(dir, lockfile), '');
      scaffoldHusky(dir);
      const content = readFileSync(join(dir, '.husky', 'pre-push'), 'utf-8');
      expect(content).toContain('SECRETS');
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// scaffoldCI
// ---------------------------------------------------------------------------

describe('scaffoldCI', () => {
  it('uses foundry-ci reusable workflow for pnpm repos', () => {
    writeFileSync(join(tmpDir, 'pnpm-lock.yaml'), '');
    scaffoldCI(tmpDir);
    const content = readFileSync(join(tmpDir, '.github', 'workflows', 'ci.yml'), 'utf-8');
    expect(content).toContain('foundry-ci.yml@v1');
    expect(content).not.toContain('pnpm install');
  });

  it('generates self-contained CI with bun install for bun repos', () => {
    writeFileSync(join(tmpDir, 'bun.lock'), '');
    scaffoldCI(tmpDir);
    const content = readFileSync(join(tmpDir, '.github', 'workflows', 'ci.yml'), 'utf-8');
    expect(content).not.toContain('foundry-ci.yml@v1');
    expect(content).toContain('oven-sh/setup-bun');
    expect(content).toContain('bun install --frozen-lockfile');
  });

  it('generates self-contained CI with npm ci for npm repos', () => {
    writeFileSync(join(tmpDir, 'package-lock.json'), '');
    scaffoldCI(tmpDir);
    const content = readFileSync(join(tmpDir, '.github', 'workflows', 'ci.yml'), 'utf-8');
    expect(content).not.toContain('foundry-ci.yml@v1');
    expect(content).toContain('npm ci');
    expect(content).toContain('npm run lint');
  });

  it('generates self-contained CI with yarn for yarn repos', () => {
    writeFileSync(join(tmpDir, 'yarn.lock'), '');
    scaffoldCI(tmpDir);
    const content = readFileSync(join(tmpDir, '.github', 'workflows', 'ci.yml'), 'utf-8');
    expect(content).not.toContain('foundry-ci.yml@v1');
    expect(content).toContain('yarn install --frozen-lockfile');
    expect(content).toContain('yarn lint');
  });

  it('defaults to foundry-ci reusable workflow when no lockfile (pnpm default)', () => {
    scaffoldCI(tmpDir);
    const content = readFileSync(join(tmpDir, '.github', 'workflows', 'ci.yml'), 'utf-8');
    expect(content).toContain('foundry-ci.yml@v1');
  });

  it('does not overwrite existing ci.yml without --force', () => {
    const ciDir = join(tmpDir, '.github', 'workflows');
    mkdirSync(ciDir, { recursive: true });
    writeFileSync(join(ciDir, 'ci.yml'), '# existing ci\n');
    scaffoldCI(tmpDir);
    const content = readFileSync(join(ciDir, 'ci.yml'), 'utf-8');
    expect(content).toContain('existing ci');
  });

  it('overwrites existing ci.yml with --force', () => {
    writeFileSync(join(tmpDir, 'bun.lock'), '');
    const ciDir = join(tmpDir, '.github', 'workflows');
    mkdirSync(ciDir, { recursive: true });
    writeFileSync(join(ciDir, 'ci.yml'), '# existing ci\n');
    scaffoldCI(tmpDir, { force: true });
    const content = readFileSync(join(ciDir, 'ci.yml'), 'utf-8');
    expect(content).not.toContain('existing ci');
    expect(content).toContain('bun install');
  });
});
