import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getLocalFleet } from '../fleet';
import fs from 'node:fs';

vi.mock('node:fs');

describe('Fleet Detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // realpathSync must return the path unchanged — required by scanDir
    vi.spyOn(fs, 'realpathSync').mockImplementation((p: any) => String(p));
  });

  it('should detect foundry and legacy projects', () => {
    vi.spyOn(fs, 'readdirSync').mockReturnValue([
      { name: 'project-a', isDirectory: () => true, isSymbolicLink: () => false },
      { name: 'project-b', isDirectory: () => true, isSymbolicLink: () => false },
      { name: 'not-a-project', isDirectory: () => true, isSymbolicLink: () => false },
    ] as any);

    vi.spyOn(fs, 'existsSync').mockImplementation((p: any) => {
      const s = String(p);
      if (s.endsWith('fleet')) return true; // fleetPath exists
      if (s.includes('project-a/foundry.json')) return true;
      if (s.includes('project-b/package.json')) return true;
      return false;
    });

    vi.spyOn(fs, 'readFileSync').mockImplementation((p: any) => {
      const s = String(p);
      if (s.includes('project-b/package.json')) {
        return JSON.stringify({ name: 'Project B', dependencies: { next: '15' } });
      }
      return '{}';
    });

    const fleet = getLocalFleet();

    expect(fleet.find(p => p.slug === 'project-a')?.isFoundry).toBe(true);
    expect(fleet.find(p => p.slug === 'project-b')?.isFoundry).toBe(false);
    expect(fleet.find(p => p.slug === 'project-b')?.type).toBe('next');
  });

  it('detects vite from devDependencies (not just dependencies)', () => {
    vi.spyOn(fs, 'readdirSync').mockReturnValue([
      { name: 'vite-app', isDirectory: () => true, isSymbolicLink: () => false },
    ] as any);

    vi.spyOn(fs, 'existsSync').mockImplementation((p: any) => {
      const s = String(p);
      if (s.endsWith('fleet')) return true; // fleetPath exists
      if (s.includes('vite-app/foundry.json')) return true;
      if (s.includes('vite-app/package.json')) return true;
      return false;
    });

    vi.spyOn(fs, 'readFileSync').mockImplementation((p: any) => {
      if (String(p).includes('vite-app/package.json')) {
        return JSON.stringify({
          name: 'vite-app',
          // vite is in devDependencies only — the old code would miss this
          devDependencies: { vite: '^5.0.0' },
        });
      }
      return '{}';
    });

    const fleet = getLocalFleet();
    expect(fleet.find(p => p.slug === 'vite-app')?.type).toBe('vite');
  });
});
