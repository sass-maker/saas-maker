import { describe, expect, it, vi } from 'vitest';

type MockContext = {
  set: (key: string, value: unknown) => void;
};

vi.mock('../../workers/api/src/middleware/auth', () => ({
  requireSession: async (c: MockContext, next: () => Promise<void>) => {
    c.set('userId', 'user-1');
    await next();
  },
  requireApiKey: async (_c: MockContext, next: () => Promise<void>) => {
    await next();
  },
  requireApiKeyOrSession: async (c: MockContext, next: () => Promise<void>) => {
    c.set('userId', 'user-1');
    await next();
  },
  resolveBearerUserId: vi.fn().mockResolvedValue('user-1'),
}));

vi.mock('../../workers/api/src/lib/telemetry.js', () => ({
  capture: vi.fn(),
}));

import { request } from './helpers';

function createMockD1() {
  const rows: Record<string, unknown>[] = [];
  return {
    prepare: (sql: string) => ({
      bind: (...values: unknown[]) => ({
        run: async () => {
          if (sql.includes('INSERT INTO marketing_posts')) {
            rows.push({
              id: values[0],
              owner_id: values[1],
              project_slug: values[2],
              channel: values[3],
              status: values[4],
              title: values[5],
              body: values[7],
            });
          }
          return { meta: { changes: 1 } };
        },
        first: async () =>
          rows.find((row) => row.id === values[0] && row.owner_id === values[1]) ?? null,
        all: async () => ({ results: rows }),
      }),
    }),
  };
}

describe('marketing posts API', () => {
  it('accepts reel-platform channels for AI video briefs', async () => {
    const res = await request(
      '/v1/marketing/posts',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          project_slug: 'linkchat',
          channel: 'tiktok',
          status: 'generated',
          source_type: 'task',
          title: 'AI video hook',
          body: 'AI video brief with shot list and captions.',
        }),
      },
      { DB: createMockD1() }
    );

    expect(res.status).toBe(201);
    const payload = (await res.json()) as { data: { channel: string } };
    expect(payload.data.channel).toBe('tiktok');
  });
});
