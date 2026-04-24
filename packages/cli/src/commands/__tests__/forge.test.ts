import { describe, it, expect, vi, beforeEach } from 'vitest';
import { forgeCommand } from '../forge';
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
vi.mock('../lib/request', () => ({
  requestApi: vi.fn().mockResolvedValue({
    ok: true,
    data: { id: '123', name: 'Test Project', slug: 'test-project', api_key: 'pk_123' }
  }),
  getResponseError: vi.fn(),
}));

vi.mock('node:readline/promises', () => ({
  createInterface: vi.fn().mockReturnValue({
    question: vi.fn()
      .mockResolvedValueOnce('My Project')
      .mockResolvedValueOnce('next'),
    close: vi.fn(),
  }),
}));

vi.mock('../lib/config', () => ({
  getApiKey: vi.fn().mockReturnValue('fake-token'),
  getApiBase: vi.fn().mockReturnValue('https://api.fake.com'),
  saveLocalConfig: vi.fn(),
  hasLocalConfig: vi.fn().mockReturnValue(false),
}));

describe('Forge Scaffolding with Templates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create project and copy template files', async () => {
    const writeSpy = vi.spyOn(fs, 'writeFileSync');
    const mkdirSpy = vi.spyOn(fs, 'mkdirSync');
    
    // Mock template directory contents
    vi.spyOn(fs, 'statSync').mockReturnValue({ isDirectory: () => true } as any);
    vi.spyOn(fs, 'readdirSync').mockReturnValue(['package.json.tmpl', 'tsconfig.json'] as any);
    vi.spyOn(fs, 'readFileSync').mockImplementation((p: any) => {
      if (p.includes('package.json.tmpl')) return '{"name": "{{name}}"}';
      if (p.includes('tsconfig.json')) return '{"extends": "base"}';
      return '';
    });

    await forgeCommand({ name: 'My Project', type: 'next' });

    // Check template substitution
    expect(writeSpy).toHaveBeenCalledWith(
      expect.stringContaining('package.json'),
      expect.stringContaining('my-project')
    );
  });
});
