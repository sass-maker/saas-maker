import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const roots = ['internal/contracts/content-factory.ts', 'services/content-factory'];
const sourceFiles = roots.flatMap((root) => collectSourceFiles(root));

describe('Content Factory architecture boundary', () => {
  it('imports no social publishers, Postiz adapter, OAuth, or credential modules', () => {
    expect(sourceFiles.length).toBeGreaterThan(0);
    const violations: string[] = [];
    for (const file of sourceFiles) {
      const source = readFileSync(file, 'utf8');
      for (const specifier of importSpecifiers(source)) {
        if (
          /(?:^|\/)(?:publishers?|posting|social-publishers?|oauth|credentials?|secrets?|tokens?)(?:\/|$)/i.test(
            specifier
          ) ||
          specifier.includes('workers/api/src/adapters/postiz') ||
          specifier.includes('services/reel-pipeline/src/postiz')
        ) {
          violations.push(`${file} -> ${specifier}`);
        }
      }
      if (
        /(?:process\.env|\benv)\.(?:POSTIZ|INSTAGRAM|YOUTUBE|TIKTOK|FACEBOOK)[A-Z0-9_]*/.test(
          source
        )
      ) {
        violations.push(`${file} reads a social-provider credential directly`);
      }
    }
    expect(violations).toEqual([]);
  });
});

function collectSourceFiles(path: string): string[] {
  if (!existsSync(path)) return [];
  if (statSync(path).isFile()) return /\.[cm]?[jt]sx?$/.test(path) ? [path] : [];
  return readdirSync(path).flatMap((entry) => collectSourceFiles(`${path}/${entry}`));
}

function importSpecifiers(source: string): string[] {
  const matches = source.matchAll(/(?:from\s*|import\s*\(|require\s*\()\s*['"]([^'"]+)['"]/g);
  return [...matches].map((match) => match[1]!).filter(Boolean);
}
