import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DirectoryService } from '../../packages/sdk/src/services/directory';

function createMockHttp() {
  return {
    request: vi.fn(),
    requestRaw: vi.fn(),
  } as any;
}

describe('DirectoryService', () => {
  let directory: DirectoryService;
  let http: ReturnType<typeof createMockHttp>;

  beforeEach(() => {
    http = createMockHttp();
    directory = new DirectoryService(http);
  });

  describe('list', () => {
    it('fetches approved listings without params', async () => {
      http.request.mockResolvedValue({
        data: [{ id: '1', name: 'Acme', tagline: 'Fast SaaS' }],
        total: 1,
        page: 1,
        limit: 24,
      });

      const result = await directory.list();

      expect(http.request).toHaveBeenCalledWith('GET', '/v1/directory');
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('passes page, tag, and search params', async () => {
      http.request.mockResolvedValue({ data: [], total: 0, page: 2, limit: 24 });

      await directory.list({ page: 2, tag: 'ai', search: 'analytics' });

      const calledPath = http.request.mock.calls[0][1];
      expect(calledPath).toContain('page=2');
      expect(calledPath).toContain('tag=ai');
      expect(calledPath).toContain('search=analytics');
    });

    it('omits empty params from query string', async () => {
      http.request.mockResolvedValue({ data: [], total: 0, page: 1, limit: 24 });

      await directory.list({ tag: 'saas' });

      const calledPath = http.request.mock.calls[0][1];
      expect(calledPath).toContain('tag=saas');
      expect(calledPath).not.toContain('page=');
      expect(calledPath).not.toContain('search=');
    });
  });

  describe('submit', () => {
    it('submits a listing for review', async () => {
      const listing = {
        id: 'new-1',
        name: 'Acme',
        tagline: 'Ship fast',
        url: 'https://acme.com',
        status: 'pending',
        tags: ['saas'],
      };
      http.request.mockResolvedValue(listing);

      const result = await directory.submit({
        name: 'Acme',
        tagline: 'Ship fast',
        url: 'https://acme.com',
        tags: ['saas'],
      });

      expect(http.request).toHaveBeenCalledWith('POST', '/v1/directory', {
        name: 'Acme',
        tagline: 'Ship fast',
        url: 'https://acme.com',
        tags: ['saas'],
      });
      expect(result.status).toBe('pending');
    });

    it('submits with optional fields', async () => {
      http.request.mockResolvedValue({ id: 'new-2' });

      await directory.submit({
        name: 'Acme',
        tagline: 'Ship fast',
        url: 'https://acme.com',
        description: 'Full description',
        logo_url: 'https://acme.com/logo.png',
        twitter_url: 'https://twitter.com/acme',
      });

      const body = http.request.mock.calls[0][2];
      expect(body.description).toBe('Full description');
      expect(body.logo_url).toBe('https://acme.com/logo.png');
      expect(body.twitter_url).toBe('https://twitter.com/acme');
    });
  });

  describe('claim', () => {
    it('claims a listing linked to a project', async () => {
      http.request.mockResolvedValue({ id: 'claimed-1', project_id: 'proj_123' });

      const result = await directory.claim({
        name: 'My SaaS',
        tagline: 'Best tool',
        url: 'https://mysaas.com',
      });

      expect(http.request).toHaveBeenCalledWith('POST', '/v1/directory/claim', {
        name: 'My SaaS',
        tagline: 'Best tool',
        url: 'https://mysaas.com',
      });
      expect(result.project_id).toBe('proj_123');
    });
  });

  describe('verifyBadge', () => {
    it('verifies badge presence on site', async () => {
      http.request.mockResolvedValue({ verified: true, listing_id: 'abc-123' });

      const result = await directory.verifyBadge();

      expect(http.request).toHaveBeenCalledWith('POST', '/v1/directory/verify-badge');
      expect(result.verified).toBe(true);
      expect(result.listing_id).toBe('abc-123');
    });
  });
});
