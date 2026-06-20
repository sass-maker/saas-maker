import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectProjectType, applyStandard } from '../../lib/forge';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('node:fs');
vi.mock('../lib/ui', () => ({
  log: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Forge Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detectProjectType', () => {
    it('should detect Next.js project', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({
        dependencies: { next: 'latest' }
      }));
      
      expect(detectProjectType()).toBe('next');
    });

    it('should detect Vite project', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({
        devDependencies: { vite: 'latest' }
      }));
      
      expect(detectProjectType()).toBe('vite');
    });

    it('should default to node for unknown projects', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      expect(detectProjectType()).toBe('node');
    });
  });

  describe('applyStandard', () => {
    it('should write local configs for next', () => {
      const writeSpy = vi.spyOn(fs, 'writeFileSync');
      vi.spyOn(fs, 'readFileSync').mockImplementation((p: fs.PathOrFileDescriptor) => {
        const file = String(p);
        if (file.endsWith('package.json')) {
          return JSON.stringify({ name: 'test-app' });
        }
        if (file.endsWith('eslint.config.js')) {
          return 'import nextCoreWebVitals from "eslint-config-next/core-web-vitals";\nexport default [];\n';
        }
        return '';
      });
      
      applyStandard('next');
      
      expect(writeSpy).toHaveBeenCalledWith(
        expect.stringContaining('eslint.config.js'),
        expect.stringContaining('eslint-config-next'),
      );
      expect(writeSpy).toHaveBeenCalledWith(
        expect.stringContaining('tsconfig.json'),
        expect.stringContaining('"strict": true'),
      );
      expect(writeSpy).toHaveBeenCalledWith(
        expect.stringContaining('.prettierrc.json'),
        expect.stringContaining('prettier-plugin-tailwindcss'),
      );
    });
  });
});
