import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkProjectDrift, applyDriftFixes } from '../drift.js';

let tmpRoot: string;

function scaffold(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'foundry-drift-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = join(dir, rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, content);
  }
  return dir;
}

afterEach(() => {
  if (tmpRoot && existsSync(tmpRoot)) {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});

describe('checkProjectDrift', () => {
  it('passes a fully-compliant Foundry project', () => {
    tmpRoot = scaffold({
      'package.json': JSON.stringify({ name: 'demo' }),
      'biome.json': JSON.stringify({ linter: { enabled: true } }),
      'foundry.json': JSON.stringify({ slug: 'demo', linked: true }),
      'AGENTS.md': '# agents\n',
      '.husky/pre-push': '#!/bin/sh\nSECRETS=$(git ls-files)\n',
      'tsconfig.json': '{ "compilerOptions": { "strict": true, "moduleResolution": "bundler" } }',
      '.github/workflows/ci.yml': 'jobs:\n  ci:\n    uses: ./.github/workflows/foundry-ci.yml\n',
      'src/widgets/Feedback.tsx': 'export const X = null;\n',
    });

    const r = checkProjectDrift(tmpRoot, 'demo');
    expect(r.checks.find((c) => c.id === 'foundry-json')?.status).toBe('pass');
    expect(r.checks.find((c) => c.id === 'agents-md')?.status).toBe('pass');
    expect(r.checks.find((c) => c.id === 'biome')?.status).toBe('pass');
    expect(r.checks.find((c) => c.id === 'tsconfig')?.status).toBe('pass');
    expect(r.checks.find((c) => c.id === 'prettier')?.status).toBe('pass');
    expect(r.checks.find((c) => c.id === 'foundry-ci')?.status).toBe('pass');
    expect(r.checks.find((c) => c.id === 'widgets')?.status).toBe('pass');
  });

  it('flags missing foundry.json + AGENTS.md + husky', () => {
    tmpRoot = scaffold({
      'package.json': JSON.stringify({ name: 'bare' }),
    });
    const r = checkProjectDrift(tmpRoot, 'bare');
    expect(r.checks.find((c) => c.id === 'foundry-json')?.status).toBe('fail');
    expect(r.checks.find((c) => c.id === 'agents-md')?.status).toBe('warn');
    expect(r.checks.find((c) => c.id === 'husky-pre-push')?.status).toBe('fail');
    expect(r.checks.find((c) => c.id === 'biome')?.status).toBe('fail');
  });

  it('warns when no formatter config', () => {
    tmpRoot = scaffold({
      'package.json': JSON.stringify({ name: 'p' }),
    });
    const r = checkProjectDrift(tmpRoot, 'p');
    expect(r.checks.find((c) => c.id === 'prettier')?.status).toBe('warn');
  });

  it('warns when husky lacks secret-scan', () => {
    tmpRoot = scaffold({
      'package.json': '{}',
      '.husky/pre-push': '#!/bin/sh\necho ok\n',
    });
    const r = checkProjectDrift(tmpRoot, 'x');
    expect(r.checks.find((c) => c.id === 'husky-pre-push')?.status).toBe('warn');
  });
});

describe('checkProjectDrift — Biome awareness', () => {
  it('passes biome check for a Biome project', () => {
    tmpRoot = scaffold({
      'package.json': JSON.stringify({ name: 'biome-app' }),
      'biome.json': JSON.stringify({ linter: { enabled: true } }),
    });
    const r = checkProjectDrift(tmpRoot, 'biome-app');
    expect(r.checks.find((c) => c.id === 'biome')?.status).toBe('pass');
    expect(r.checks.find((c) => c.id === 'biome')?.detail).toContain('Biome');
  });

  it('passes prettier check for a Biome project (no .prettierrc needed)', () => {
    tmpRoot = scaffold({
      'package.json': JSON.stringify({ name: 'biome-app' }),
      'biome.json': JSON.stringify({ formatter: { enabled: true } }),
    });
    const r = checkProjectDrift(tmpRoot, 'biome-app');
    expect(r.checks.find((c) => c.id === 'prettier')?.status).toBe('pass');
    expect(r.checks.find((c) => c.id === 'prettier')?.detail).toContain('Biome');
  });

  it('passes biome/prettier checks for biome.jsonc (alternate extension)', () => {
    tmpRoot = scaffold({
      'package.json': JSON.stringify({ name: 'biome-jsonc' }),
      'biome.jsonc': '{}',
    });
    const r = checkProjectDrift(tmpRoot, 'biome-jsonc');
    expect(r.checks.find((c) => c.id === 'biome')?.status).toBe('pass');
    expect(r.checks.find((c) => c.id === 'prettier')?.status).toBe('pass');
  });
});

describe('applyDriftFixes', () => {
  it('writes a stub foundry.json + AGENTS.md + husky pre-push when fixes available', () => {
    tmpRoot = scaffold({ 'package.json': '{}' });
    const r = checkProjectDrift(tmpRoot, 'demo');
    const result = applyDriftFixes(r);

    expect(result.applied).toContain('foundry-json');
    expect(result.applied).toContain('agents-md');
    expect(result.applied).toContain('husky-pre-push');

    expect(existsSync(join(tmpRoot, 'foundry.json'))).toBe(true);
    expect(existsSync(join(tmpRoot, 'AGENTS.md'))).toBe(true);
    expect(existsSync(join(tmpRoot, '.husky/pre-push'))).toBe(true);

    const husky = readFileSync(join(tmpRoot, '.husky/pre-push'), 'utf-8');
    expect(husky).toContain('SECRETS');
  });

  it('lists checks without fixes in skipped[]', () => {
    tmpRoot = scaffold({ 'package.json': '{}' });
    const r = checkProjectDrift(tmpRoot, 'demo');
    const result = applyDriftFixes(r);
    expect(result.skipped).toContain('biome');
  });
});
