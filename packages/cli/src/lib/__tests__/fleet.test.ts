import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getLocalFleet } from '../fleet';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('node:fs');

describe('Fleet Detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should detect foundry and legacy projects', () => {
    // Mock readdir to show 3 folders
    vi.spyOn(fs, 'readdirSync').mockImplementation((p: any) => {
      if (!String(p).endsWith('Fleet')) return [] as any;
      return [
        { name: 'project-a', isDirectory: () => true },
        { name: 'project-b', isDirectory: () => true },
        { name: 'not-a-project', isDirectory: () => true },
      ] as any;
    });

    // Mock existsSync
    vi.spyOn(fs, 'existsSync').mockImplementation((p: any) => {
      if (String(p).endsWith('Fleet')) return true;
      if (p.includes('project-a/foundry.json')) return true;
      if (p.includes('project-b/.saasmaker.json')) return true;
      if (p.includes('project-b/package.json')) return true;
      return false;
    });

    vi.spyOn(fs, 'realpathSync').mockImplementation((p: any) => String(p) as any);

    // Mock readFileSync
    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({
      name: 'Project B',
      dependencies: { next: '15' }
    }));

    const fleet = getLocalFleet();
    
    expect(fleet).toHaveLength(2);
    expect(fleet.find(p => p.slug === 'project-a')?.isFoundry).toBe(true);
    expect(fleet.find(p => p.slug === 'project-b')?.isFoundry).toBe(false);
    expect(fleet.find(p => p.slug === 'project-b')?.type).toBe('next');
  });
});
