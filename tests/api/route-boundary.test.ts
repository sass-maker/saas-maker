import { describe, expect, it } from 'vitest';

import app from '../../workers/api/src/index';

const retainedPrefixes = ['/health', '/v1/auth', '/v1/projects', '/v1/feedback', '/v1/upload'];
const retiredPrefixes = [
  '/v1/ai',
  '/v1/changelog',
  '/v1/cli',
  '/v1/events',
  '/v1/fleet',
  '/v1/jobs',
  '/v1/marketing',
  '/v1/performance',
  '/v1/roadmap',
  '/v1/secrets',
  '/v1/standards',
  '/v1/symphony',
  '/v1/task-workflows',
  '/v1/tasks',
  '/v1/test',
  '/v1/testimonials',
  '/v1/waitlist',
];

describe('SaaS Maker API boundary', () => {
  it('registers only feedback, project-key, auth, upload, and health routes', () => {
    const paths = app.routes.map((route) => route.path);

    expect(paths.some((routePath) => routePath === '/health')).toBe(true);
    for (const prefix of retainedPrefixes.slice(1)) {
      expect(paths.some((routePath) => routePath.startsWith(prefix))).toBe(true);
    }
    for (const prefix of retiredPrefixes) {
      expect(paths.some((routePath) => routePath.startsWith(prefix))).toBe(false);
    }
  });
});
