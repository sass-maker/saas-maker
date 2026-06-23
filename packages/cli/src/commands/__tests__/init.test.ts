import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectProjectType, applyStandard, usesBiome } from '../../lib/forge';
import fs from 'node:fs';

vi.mock('node:fs');
vi.mock('../../lib/ui', () => ({
  log: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Forge Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detectProjectType', () => {
    it('detects Next.js project from dependencies', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({
        dependencies: { next: 'latest' },
      }));
      expect(detectProjectType()).toBe('next');
    });

    it('detects Vite project from devDependencies', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({
        devDependencies: { vite: 'latest' },
      }));
      expect(detectProjectType()).toBe('vite');
    });

    it('detects Astro project as astro (first-class VoidZero type)', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({
        devDependencies: { astro: '4.0.0' },
      }));
      expect(detectProjectType()).toBe('astro');
    });

    it('defaults to node for unknown projects (no package.json)', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      expect(detectProjectType()).toBe('node');
    });
  });

  describe('usesBiome', () => {
    it('returns true when biome.json is present', () => {
      vi.spyOn(fs, 'existsSync').mockImplementation((p: any) =>
        String(p).endsWith('biome.json'),
      );
      expect(usesBiome('/fake/project')).toBe(true);
    });

    it('returns true when biome.jsonc is present', () => {
      vi.spyOn(fs, 'existsSync').mockImplementation((p: any) =>
        String(p).endsWith('biome.jsonc'),
      );
      expect(usesBiome('/fake/project')).toBe(true);
    });

    it('returns false when no biome config is present', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      expect(usesBiome('/fake/project')).toBe(false);
    });
  });

  describe('applyStandard — overwrite guards', () => {
    /** Helper: set up existsSync so biome/package.json checks return expected values. */
    function mockExistsSync(opts: { hasPkg: boolean; hasBiome: boolean; hasTsconfig: boolean }) {
      vi.spyOn(fs, 'existsSync').mockImplementation((p: any) => {
        const s = String(p);
        if (s.endsWith('biome.json') || s.endsWith('biome.jsonc')) return opts.hasBiome;
        if (s.endsWith('package.json')) return opts.hasPkg;
        if (s.endsWith('tsconfig.json')) return opts.hasTsconfig;
        return false;
      });
    }

    it('skips writing biome.json when it already exists (no --force)', () => {
      const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      vi.spyOn(fs, 'readFileSync').mockImplementation((p: any) => {
        const s = String(p);
        if (s.endsWith('package.json')) return JSON.stringify({ name: 'test-app' });
        if (s.endsWith('biome.json.tmpl')) return JSON.stringify({ linter: { enabled: true } });
        return '';
      });
      mockExistsSync({ hasPkg: true, hasBiome: true, hasTsconfig: true });

      applyStandard('next', '/fake', undefined, { force: false });

      // biome.json must NOT be written (already exists)
      expect(writeSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('biome.json'),
        expect.anything(),
      );
    });

    it('writes biome.json when --force is true even if it exists', () => {
      const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      vi.spyOn(fs, 'readFileSync').mockImplementation((p: any) => {
        const s = String(p);
        if (s.endsWith('package.json')) return JSON.stringify({ name: 'test-app' });
        if (s.endsWith('biome.json.tmpl')) return JSON.stringify({ linter: { enabled: true } });
        return '';
      });
      mockExistsSync({ hasPkg: true, hasBiome: true, hasTsconfig: true });

      applyStandard('next', '/fake', undefined, { force: true });

      expect(writeSpy).toHaveBeenCalledWith(
        expect.stringContaining('biome.json'),
        expect.anything(),
      );
    });

    it('skips writing tsconfig.json when it already exists (no --force)', () => {
      const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      vi.spyOn(fs, 'readFileSync').mockImplementation((p: any) => {
        if (String(p).endsWith('package.json')) return JSON.stringify({ name: 'test-app' });
        if (String(p).endsWith('biome.json.tmpl')) return JSON.stringify({ linter: { enabled: true } });
        return '';
      });
      mockExistsSync({ hasPkg: true, hasBiome: false, hasTsconfig: true });

      applyStandard('node', '/fake', undefined, { force: false });

      expect(writeSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('tsconfig.json'),
        expect.anything(),
      );
    });

    it('skips entirely when no package.json (Go/Rust guard)', () => {
      const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      mockExistsSync({ hasPkg: false, hasBiome: false, hasTsconfig: false });

      applyStandard('node', '/fake/go-project');

      expect(writeSpy).not.toHaveBeenCalled();
    });
  });

  describe('applyStandard — Biome scaffolding', () => {
    it('writes biome.json and tsconfig for a new project', () => {
      const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      vi.spyOn(fs, 'readFileSync').mockImplementation((p: any) => {
        const s = String(p);
        if (s.endsWith('package.json')) return JSON.stringify({ name: 'new-app' });
        if (s.endsWith('biome.json.tmpl')) return JSON.stringify({ linter: { enabled: true } });
        return '';
      });
      vi.spyOn(fs, 'existsSync').mockImplementation((p: any) => {
        const s = String(p);
        if (s.endsWith('package.json')) return true;
        return false;
      });

      applyStandard('next', '/fake/new-project');

      // biome.json MUST be written
      expect(writeSpy).toHaveBeenCalledWith(
        expect.stringContaining('biome.json'),
        expect.anything(),
      );
      // tsconfig MUST be written
      expect(writeSpy).toHaveBeenCalledWith(
        expect.stringContaining('tsconfig.json'),
        expect.stringContaining('"strict": true'),
      );
    });

    it('skips all writes when biome.json and tsconfig already exist (no --force)', () => {
      const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      vi.spyOn(fs, 'readFileSync').mockImplementation(() => JSON.stringify({ name: 'biome-app' }));
      vi.spyOn(fs, 'existsSync').mockImplementation((p: any) => {
        const s = String(p);
        if (s.endsWith('biome.json')) return true;
        if (s.endsWith('package.json')) return true;
        if (s.endsWith('tsconfig.json')) return true;
        return false;
      });

      applyStandard('node', '/fake/biome-project', undefined, { force: false });

      expect(writeSpy).not.toHaveBeenCalled();
    });
  });
});
