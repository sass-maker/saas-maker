import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { resolveProjectCwd } from '../../scripts/symphony-local.mjs';

const originalCwd = process.cwd();
let tempDir: string | null = null;

afterEach(() => {
  process.chdir(originalCwd);
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

describe('symphony-local project cwd resolution', () => {
  it('uses an explicit project path from foundry.projects.json', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'symphony-local-'));
    process.chdir(tempDir);
    writeFileSync(
      'foundry.projects.json',
      JSON.stringify({
        'resume-tailor': {
          path: '/Users/sarthak/Desktop/fleet/rolepatch',
        },
      })
    );

    expect(resolveProjectCwd('resume-tailor')).toBe('/Users/sarthak/Desktop/fleet/rolepatch');
  });

  it('falls back to the fleet slug directory when no explicit path exists', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'symphony-local-'));
    process.chdir(tempDir);
    writeFileSync('foundry.projects.json', JSON.stringify({}));

    expect(resolveProjectCwd('saas-maker')).toBe(`${process.env.HOME}/Desktop/fleet/saas-maker`);
  });
});
