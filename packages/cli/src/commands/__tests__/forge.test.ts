import { describe, it, expect, vi, beforeEach } from 'vitest';
import { forgeCommand } from '../forge';
import fs from 'node:fs';

// vi.hoisted ensures the fn is created before vi.mock hoisting runs
const mockRequestApi = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    ok: true,
    data: { id: '123', name: 'Test Project', slug: 'test-project', api_key: 'pk_123' },
  }),
);

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
vi.mock('../../lib/request', () => ({
  requestApi: mockRequestApi,
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

vi.mock('../../lib/config', () => ({
  getApiKey: vi.fn().mockReturnValue('fake-token'),
  getApiBase: vi.fn().mockReturnValue('https://api.fake.com'),
  saveLocalConfig: vi.fn(),
  hasLocalConfig: vi.fn().mockReturnValue(false),
}));

describe('Forge Scaffolding with Templates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore the requestApi behavior after clearAllMocks clears call history
    mockRequestApi.mockResolvedValue({
      ok: true,
      data: { id: '123', name: 'Test Project', slug: 'test-project', api_key: 'pk_123' },
    });
  });

  it('should create project and copy template files', async () => {
    const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    vi.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined as any);
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    // statSync: template root dir → isDirectory true; template files → isDirectory false
    vi.spyOn(fs, 'statSync').mockImplementation((p: any) => {
      const s = String(p);
      const isDir = s.endsWith('next') || s.endsWith('test-project');
      return { isDirectory: () => isDir } as any;
    });
    // readdirSync: only called on the template root dir (ends with 'next')
    vi.spyOn(fs, 'readdirSync').mockImplementation((p: any) => {
      if (String(p).endsWith('next')) return ['package.json.tmpl'] as any;
      return [] as any;
    });
    vi.spyOn(fs, 'readFileSync').mockImplementation((p: any) => {
      if (String(p).includes('package.json.tmpl')) return '{"name": "{{name}}"}';
      return '';
    });

    await forgeCommand({ name: 'My Project', type: 'next' });

    // The slug from the mock is 'test-project'; template substitutes {{name}} → slug
    expect(writeSpy).toHaveBeenCalledWith(
      expect.stringContaining('package.json'),
      expect.stringContaining('test-project'),
    );
  });
});
