import { Hono } from 'hono';
import { Bindings, Variables } from '../types';
import { getDb } from '../db';

const progress = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const DEFAULT_CHANGELOG_LIMIT = 20;
const MAX_CHANGELOG_LIMIT = 50;

function parseLimit(raw: string | undefined): number {
  const parsed = Number.parseInt(raw || String(DEFAULT_CHANGELOG_LIMIT), 10);
  if (Number.isNaN(parsed) || parsed <= 0) return DEFAULT_CHANGELOG_LIMIT;
  return Math.min(parsed, MAX_CHANGELOG_LIMIT);
}

progress.get('/public/:slug', async (c) => {
  const slug = c.req.param('slug');
  const changelogLimit = parseLimit(c.req.query('changelog_limit'));

  const db = getDb(c.env.DB);
  const project = await db.getProjectBySlug(slug);
  if (!project) return c.json({ error: 'Project not found' }, 404);

  const [changelog, roadmap] = await Promise.all([
    db.listPublishedChangelog(project.id, changelogLimit),
    db.listRoadmapItems(project.id, true),
  ]);

  return c.json({
    project: { name: project.name, slug: project.slug },
    changelog,
    roadmap,
  });
});

export { progress };
