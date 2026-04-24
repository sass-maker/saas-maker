import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectProjectType, applyStandard } from '../init';
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
    it('should write correct configs for next', () => {
      const writeSpy = vi.spyOn(fs, 'writeFileSync');
      vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ name: 'test-app' }));
      
      applyStandard('next');
      
      expect(writeSpy).toHaveBeenCalledWith(
        expect.stringContaining('eslint.config.js'),
        expect.stringContaining('@saas-maker/eslint-config/next')
      );
      expect(writeSpy).toHaveBeenCalledWith(
        expect.stringContaining('tsconfig.json'),
        expect.stringContaining('@saas-maker/tsconfig/next.json')
      );
    });
  });
});
