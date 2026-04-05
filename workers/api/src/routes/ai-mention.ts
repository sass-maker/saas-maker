import { Hono } from 'hono';
import { Bindings, Variables } from '../types';
import { requireSession } from '../middleware/auth';
import { getDb } from '../db';
import { runMentionCheck } from '../lib/ai-mention-engine';
import type {
  AIMentionConfigDbRecord,
  AIMentionConfigRecord,
  AIMentionResultRecord,
  AIMentionPlatform,
} from '@saas-maker/shared-types';

const aiMention = new Hono<{ Bindings: Bindings; Variables: Variables }>();

aiMention.use('*', requireSession);

const VALID_PLATFORMS: AIMentionPlatform[] = ['openai', 'anthropic', 'google', 'perplexity'];
const MAX_PROMPTS = 20;
const MAX_COMPETITORS = 5;

function scheduleBackgroundTask(c: any, task: Promise<unknown>) {
  try {
    c.executionCtx.waitUntil(task);
  } catch {
    void task;
  }
}

function toConfigRecord(row: AIMentionConfigDbRecord): AIMentionConfigRecord {
  return {
    id: row.id,
    project_id: row.project_id,
    brand_name: row.brand_name,
    brand_aliases: JSON.parse(row.brand_aliases || '[]'),
    brand_url: row.brand_url,
    competitors: JSON.parse(row.competitors || '[]'),
    platforms: JSON.parse(row.platforms || '[]'),
    has_openai_key: !!row.openai_api_key,
    has_anthropic_key: !!row.anthropic_api_key,
    has_google_key: !!row.google_api_key,
    has_perplexity_key: !!row.perplexity_api_key,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toResultRecord(row: any): AIMentionResultRecord {
  return {
    ...row,
    brand_mentioned: !!row.brand_mentioned,
    brand_cited: !!row.brand_cited,
    competitors_mentioned: JSON.parse(row.competitors_mentioned || '[]'),
    citations: JSON.parse(row.citations || '[]'),
  };
}

async function verifyProjectOwnership(c: any, projectId: string) {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return null;
  return { db, project };
}

// --- Config ---

aiMention.get('/config/:projectId', async (c) => {
  const projectId = c.req.param('projectId');
  const result = await verifyProjectOwnership(c, projectId);
  if (!result) return c.json({ error: 'Forbidden' }, 403);

  const row = await result.db.getAIMentionConfig(projectId);
  return c.json(row ? toConfigRecord(row) : null);
});

aiMention.post('/config/:projectId', async (c) => {
  const projectId = c.req.param('projectId');
  const result = await verifyProjectOwnership(c, projectId);
  if (!result) return c.json({ error: 'Forbidden' }, 403);

  const body = await c.req.json();
  if (!body.brand_name?.trim()) return c.json({ error: 'brand_name is required' }, 400);

  const competitors = body.competitors || [];
  if (competitors.length > MAX_COMPETITORS) return c.json({ error: `Max ${MAX_COMPETITORS} competitors` }, 400);

  const platforms = body.platforms || ['openai', 'anthropic', 'google', 'perplexity'];
  if (!platforms.every((p: string) => VALID_PLATFORMS.includes(p as AIMentionPlatform))) {
    return c.json({ error: 'Invalid platform' }, 400);
  }

  const row = await result.db.upsertAIMentionConfig({
    id: crypto.randomUUID(),
    project_id: projectId,
    brand_name: body.brand_name.trim(),
    brand_aliases: JSON.stringify(body.brand_aliases || []),
    brand_url: body.brand_url || null,
    competitors: JSON.stringify(competitors),
    platforms: JSON.stringify(platforms),
    openai_api_key: body.openai_api_key || null,
    anthropic_api_key: body.anthropic_api_key || null,
    google_api_key: body.google_api_key || null,
    perplexity_api_key: body.perplexity_api_key || null,
  });

  return c.json(toConfigRecord(row));
});

aiMention.delete('/config/:projectId', async (c) => {
  const projectId = c.req.param('projectId');
  const result = await verifyProjectOwnership(c, projectId);
  if (!result) return c.json({ error: 'Forbidden' }, 403);

  await result.db.deleteAIMentionConfig(projectId);
  return c.json({ ok: true });
});

// --- Prompts ---

aiMention.get('/prompts/:projectId', async (c) => {
  const projectId = c.req.param('projectId');
  const result = await verifyProjectOwnership(c, projectId);
  if (!result) return c.json({ error: 'Forbidden' }, 403);

  const prompts = await result.db.listAIMentionPrompts(projectId);
  return c.json(prompts);
});

aiMention.post('/prompts/:projectId', async (c) => {
  const projectId = c.req.param('projectId');
  const result = await verifyProjectOwnership(c, projectId);
  if (!result) return c.json({ error: 'Forbidden' }, 403);

  const body = await c.req.json();
  if (!body.prompt_text?.trim()) return c.json({ error: 'prompt_text is required' }, 400);

  const count = await result.db.countAIMentionPrompts(projectId);
  if (count >= MAX_PROMPTS) return c.json({ error: `Max ${MAX_PROMPTS} prompts per project` }, 400);

  const prompt = await result.db.createAIMentionPrompt({
    id: crypto.randomUUID(),
    project_id: projectId,
    prompt_text: body.prompt_text.trim(),
    category: body.category || null,
  });

  return c.json(prompt, 201);
});

aiMention.delete('/prompts/:projectId/:id', async (c) => {
  const projectId = c.req.param('projectId');
  const result = await verifyProjectOwnership(c, projectId);
  if (!result) return c.json({ error: 'Forbidden' }, 403);

  const deleted = await result.db.deleteAIMentionPrompt(c.req.param('id'));
  if (!deleted) return c.json({ error: 'Not found' }, 404);
  return c.json({ ok: true });
});

// --- Checks ---

aiMention.post('/check/:projectId', async (c) => {
  const projectId = c.req.param('projectId');
  const result = await verifyProjectOwnership(c, projectId);
  if (!result) return c.json({ error: 'Forbidden' }, 403);

  const config = await result.db.getAIMentionConfig(projectId);
  if (!config) return c.json({ error: 'Configure AI Mention Check first' }, 400);

  const prompts = await result.db.listAIMentionPrompts(projectId);
  if (prompts.length === 0) return c.json({ error: 'Add at least one prompt' }, 400);

  const platforms = JSON.parse(config.platforms) as AIMentionPlatform[];
  const activePlatforms = platforms.filter((p: AIMentionPlatform) => {
    const keyMap: Record<AIMentionPlatform, string | null> = {
      openai: config.openai_api_key,
      anthropic: config.anthropic_api_key,
      google: config.google_api_key,
      perplexity: config.perplexity_api_key,
    };
    return !!keyMap[p];
  });

  if (activePlatforms.length === 0) return c.json({ error: 'Add at least one API key' }, 400);

  const checkId = crypto.randomUUID();
  const totalQueries = prompts.length * activePlatforms.length;

  const check = await result.db.createAIMentionCheck({
    id: checkId,
    project_id: projectId,
    total_queries: totalQueries,
  });

  // Run check in background
  scheduleBackgroundTask(
    c,
    runMentionCheck(result.db, config, prompts, checkId, projectId)
      .catch((err) => console.error('AI mention check failed:', err))
  );

  return c.json(check, 201);
});

aiMention.get('/checks/:projectId', async (c) => {
  const projectId = c.req.param('projectId');
  const result = await verifyProjectOwnership(c, projectId);
  if (!result) return c.json({ error: 'Forbidden' }, 403);

  const checks = await result.db.listAIMentionChecks(projectId);
  return c.json(checks);
});

aiMention.get('/checks/:projectId/:checkId', async (c) => {
  const projectId = c.req.param('projectId');
  const result = await verifyProjectOwnership(c, projectId);
  if (!result) return c.json({ error: 'Forbidden' }, 403);

  const check = await result.db.getAIMentionCheckById(c.req.param('checkId'));
  if (!check || check.project_id !== projectId) return c.json({ error: 'Not found' }, 404);

  const results = await result.db.listAIMentionResults(check.id);
  return c.json({ ...check, results: results.map(toResultRecord) });
});

// --- Dashboard ---

aiMention.get('/dashboard/:projectId', async (c) => {
  const projectId = c.req.param('projectId');
  const result = await verifyProjectOwnership(c, projectId);
  if (!result) return c.json({ error: 'Forbidden' }, 403);

  const [configRow, prompts, checks] = await Promise.all([
    result.db.getAIMentionConfig(projectId),
    result.db.listAIMentionPrompts(projectId),
    result.db.listAIMentionChecks(projectId, 5),
  ]);

  const config = configRow ? toConfigRecord(configRow) : null;

  let latestResults: AIMentionResultRecord[] = [];
  if (checks.length > 0) {
    const rawResults = await result.db.listAIMentionResults(checks[0].id);
    latestResults = rawResults.map(toResultRecord);
  }

  return c.json({ config, prompts, recent_checks: checks, latest_results: latestResults });
});

export { aiMention };
