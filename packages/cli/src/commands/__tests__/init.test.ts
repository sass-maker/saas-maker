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
      vi.spyOn(fs, 'readFileSync').mockReturnValue(
        JSON.stringify({
          dependencies: { next: 'latest' },
        })
      );
      expect(detectProjectType()).toBe('next');
    });

    it('detects Vite project from devDependencies', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(
        JSON.stringify({
          devDependencies: { vite: 'latest' },
        })
      );
      expect(detectProjectType()).toBe('vite');
    });

    it('detects Astro project as vite (correct config, not node)', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(
        JSON.stringify({
          devDependencies: { astro: '4.0.0' },
        })
      );
      expect(detectProjectType()).toBe('vite');
    });

    it('defaults to node for unknown projects (no package.json)', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      expect(detectProjectType()).toBe('node');
    });
  });

  describe('usesBiome', () => {
    it('returns true when biome.json is present', () => {
      vi.spyOn(fs, 'existsSync').mockImplementation((p: any) => String(p).endsWith('biome.json'));
      expect(usesBiome('/fake/project')).toBe(true);
    });

    it('returns true when biome.jsonc is present', () => {
      vi.spyOn(fs, 'existsSync').mockImplementation((p: any) => String(p).endsWith('biome.jsonc'));
      expect(usesBiome('/fake/project')).toBe(true);
    });

    it('returns false when no biome config is present', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      expect(usesBiome('/fake/project')).toBe(false);
    });
  });

  describe('applyStandard — overwrite guards', () => {
    /** Helper: set up existsSync so biome/package.json checks return expected values. */
    function mockExistsSync(opts: {
      hasPkg: boolean;
      hasBiome: boolean;
      hasEslint: boolean;
      hasTsconfig: boolean;
      hasPrettier: boolean;
    }) {
      vi.spyOn(fs, 'existsSync').mockImplementation((p: any) => {
        const s = String(p);
        if (s.endsWith('biome.json') || s.endsWith('biome.jsonc')) return opts.hasBiome;
        if (s.endsWith('package.json')) return opts.hasPkg;
        if (s.endsWith('eslint.config.js')) return opts.hasEslint;
        if (s.endsWith('tsconfig.json')) return opts.hasTsconfig;
        if (s.endsWith('.prettierrc.json')) return opts.hasPrettier;
        return false;
      });
    }

    it('skips writing eslint.config.js when it already exists (no --force)', () => {
      const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      vi.spyOn(fs, 'readFileSync').mockImplementation((p: any) => {
        const s = String(p);
        if (s.endsWith('package.json')) return JSON.stringify({ name: 'test-app' });
        if (s.endsWith('eslint.config.js'))
          return 'import nextCoreWebVitals from "eslint-config-next";\nexport default [];\n';
        return '';
      });
      mockExistsSync({
        hasPkg: true,
        hasBiome: false,
        hasEslint: true,
        hasTsconfig: false,
        hasPrettier: false,
      });

      applyStandard('next', '/fake', undefined, { force: false });

      // eslint.config.js must NOT be written
      expect(writeSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('eslint.config.js'),
        expect.anything()
      );
    });

    it('writes eslint.config.js when --force is true even if it exists', () => {
      const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      vi.spyOn(fs, 'readFileSync').mockImplementation((p: any) => {
        const s = String(p);
        if (s.endsWith('package.json')) return JSON.stringify({ name: 'test-app' });
        if (s.endsWith('eslint.config.js'))
          return 'import nextCoreWebVitals from "eslint-config-next";\nexport default [];\n';
        return '';
      });
      mockExistsSync({
        hasPkg: true,
        hasBiome: false,
        hasEslint: true,
        hasTsconfig: true,
        hasPrettier: true,
      });

      applyStandard('next', '/fake', undefined, { force: true });

      expect(writeSpy).toHaveBeenCalledWith(
        expect.stringContaining('eslint.config.js'),
        expect.anything()
      );
    });

    it('skips writing tsconfig.json when it already exists (no --force)', () => {
      const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      vi.spyOn(fs, 'readFileSync').mockImplementation((p: any) => {
        if (String(p).endsWith('package.json')) return JSON.stringify({ name: 'test-app' });
        return '';
      });
      mockExistsSync({
        hasPkg: true,
        hasBiome: false,
        hasEslint: false,
        hasTsconfig: true,
        hasPrettier: false,
      });

      applyStandard('node', '/fake', undefined, { force: false });

      expect(writeSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('tsconfig.json'),
        expect.anything()
      );
    });

    it('skips writing .prettierrc.json when it already exists (no --force)', () => {
      const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      vi.spyOn(fs, 'readFileSync').mockImplementation((p: any) => {
        const s = String(p);
        if (s.endsWith('package.json')) return JSON.stringify({ name: 'test-app' });
        if (s.endsWith('eslint.config.js')) return 'export default [];\n';
        return '';
      });
      mockExistsSync({
        hasPkg: true,
        hasBiome: false,
        hasEslint: false,
        hasTsconfig: false,
        hasPrettier: true,
      });

      applyStandard('node', '/fake', undefined, { force: false });

      expect(writeSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('.prettierrc.json'),
        expect.anything()
      );
    });

    it('skips entirely when no package.json (Go/Rust guard)', () => {
      const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      mockExistsSync({
        hasPkg: false,
        hasBiome: false,
        hasEslint: false,
        hasTsconfig: false,
        hasPrettier: false,
      });

      applyStandard('node', '/fake/go-project');

      expect(writeSpy).not.toHaveBeenCalled();
    });
  });

  describe('applyStandard — Biome guard', () => {
    it('skips ESLint and Prettier for Biome projects, still writes tsconfig', () => {
      const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      vi.spyOn(fs, 'readFileSync').mockImplementation(() => JSON.stringify({ name: 'biome-app' }));
      vi.spyOn(fs, 'existsSync').mockImplementation((p: any) => {
        const s = String(p);
        if (s.endsWith('biome.json')) return true;
        if (s.endsWith('package.json')) return true;
        // tsconfig doesn't exist yet
        if (s.endsWith('tsconfig.json')) return false;
        return false;
      });

      applyStandard('node', '/fake/biome-project');

      // ESLint must NOT be written
      expect(writeSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('eslint.config.js'),
        expect.anything()
      );
      // Prettier must NOT be written
      expect(writeSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('.prettierrc.json'),
        expect.anything()
      );
      // tsconfig MUST be written (Biome doesn't typecheck)
      expect(writeSpy).toHaveBeenCalledWith(
        expect.stringContaining('tsconfig.json'),
        expect.stringContaining('"strict": true')
      );
    });

    it('skips tsconfig too when it already exists in a Biome project (no --force)', () => {
      const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      vi.spyOn(fs, 'existsSync').mockImplementation((p: any) => {
        const s = String(p);
        if (s.endsWith('biome.json')) return true;
        if (s.endsWith('package.json')) return true;
        if (s.endsWith('tsconfig.json')) return true;
        return false;
      });
      vi.spyOn(fs, 'readFileSync').mockImplementation(() => JSON.stringify({ name: 'biome-app' }));

      applyStandard('node', '/fake/biome-project', undefined, { force: false });

      expect(writeSpy).not.toHaveBeenCalled();
    });
  });

  describe('applyStandard — node prettier has no tailwind plugin', () => {
    it('writes .prettierrc.json for node without prettier-plugin-tailwindcss', () => {
      const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      vi.spyOn(fs, 'readFileSync').mockImplementation((p: any) => {
        const s = String(p);
        if (s.endsWith('package.json')) return JSON.stringify({ name: 'test-node' });
        if (s.endsWith('eslint.config.js')) return '// Plain flat ESLint\nexport default [];\n';
        return '';
      });
      vi.spyOn(fs, 'existsSync').mockImplementation((p: any) => {
        const s = String(p);
        if (s.endsWith('package.json')) return true;
        if (s.endsWith('biome.json') || s.endsWith('biome.jsonc')) return false;
        // Nothing exists yet
        return false;
      });

      applyStandard('node', '/fake/node-project');

      const prettierCall = writeSpy.mock.calls.find(([p]) =>
        String(p).endsWith('.prettierrc.json')
      );
      expect(prettierCall).toBeDefined();
      expect(prettierCall![1]).not.toContain('prettier-plugin-tailwindcss');
    });

    it('writes .prettierrc.json for vite WITH prettier-plugin-tailwindcss', () => {
      const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      vi.spyOn(fs, 'readFileSync').mockImplementation((p: any) => {
        const s = String(p);
        if (s.endsWith('package.json')) return JSON.stringify({ name: 'test-vite' });
        if (s.endsWith('eslint.config.js')) return '// Plain flat ESLint\nexport default [];\n';
        return '';
      });
      vi.spyOn(fs, 'existsSync').mockImplementation((p: any) => {
        const s = String(p);
        if (s.endsWith('package.json')) return true;
        if (s.endsWith('biome.json') || s.endsWith('biome.jsonc')) return false;
        return false;
      });

      applyStandard('vite', '/fake/vite-project');

      const prettierCall = writeSpy.mock.calls.find(([p]) =>
        String(p).endsWith('.prettierrc.json')
      );
      expect(prettierCall).toBeDefined();
      expect(prettierCall![1]).toContain('prettier-plugin-tailwindcss');
    });
  });
});
