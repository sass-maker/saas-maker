import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyStandard } from '../../lib/forge';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('node:fs');
vi.mock('../../lib/ui', () => ({
  log: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Forge Scaffolding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should apply standards to a specific target directory', () => {
    const writeSpy = vi.spyOn(fs, 'writeFileSync');
    const targetDir = '/tmp/new-project';
    
    // Mock package.json existence
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ name: 'test-app' }));
    
    applyStandard('vite', targetDir);
    
    // Check ESLint
    expect(writeSpy).toHaveBeenCalledWith(
      path.join(targetDir, 'eslint.config.js'),
      expect.stringContaining('@saas-maker/eslint-config/vite')
    );
    
    // Check TSConfig
    expect(writeSpy).toHaveBeenCalledWith(
      path.join(targetDir, 'tsconfig.json'),
      expect.stringContaining('@saas-maker/tsconfig/vite.json')
    );
  });
});
