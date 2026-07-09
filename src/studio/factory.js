import { generateIdeas } from './ideas.js';
import { IdeaStore, IDEA_STATUSES } from './idea-store.js';
import { runFacelessWorkflow } from './workflow.js';
import { buildPublishPacket } from './packet.js';

/** Fill the backlog: generate ideas for a niche and save them as `new`. */
export async function planIdeas({ niche, count = 10, store, llm } = {}) {
  if (!niche) throw new Error('niche is required');
  const ideaStore = store ?? new IdeaStore();
  const result = await generateIdeas({ niche, count, llm });
  const saved = [];
  for (const idea of result.data.ideas) {
    saved.push(await ideaStore.saveIdea({
      title: idea.title,
      niche,
      angle: idea.angle,
      hook: idea.hook,
      format: idea.format,
    }));
  }
  return { source: result.source, planned: saved };
}

/**
 * Advance the next N `new` ideas through script → render → quality → packet.
 * Failures are isolated per idea; a failed idea stays `new` for retry.
 */
export async function produceNext({
  count = 1,
  engine = 'kokoro',
  store,
  workflow = runFacelessWorkflow,
  packetBuilder = buildPublishPacket,
  llm,
  logger = console,
  ...workflowOptions
} = {}) {
  const ideaStore = store ?? new IdeaStore();
  const backlog = (await ideaStore.listIdeas({ status: 'new' })).slice(0, Math.max(1, count));
  if (!backlog.length) return { produced: [], message: 'backlog empty — run factory plan first' };

  const produced = [];
  for (const idea of backlog) {
    try {
      const summary = await workflow({
        ...workflowOptions,
        topic: idea.title,
        niche: idea.niche ?? undefined,
        engine,
        ideaId: idea.id,
        ideaStore,
        llm,
        logger,
      });
      let packet = null;
      try {
        packet = await packetBuilder({ artifactDir: summary.artifactDir, llm });
      } catch (error) {
        logger.warn?.(`packet build failed for ${idea.id}: ${error.message}`);
      }
      produced.push({
        ideaId: idea.id,
        title: idea.title,
        ok: true,
        video: summary.video,
        quality: summary.quality ?? null,
        packetDir: packet?.packetDir ?? null,
        artifactDir: summary.artifactDir,
      });
    } catch (error) {
      produced.push({ ideaId: idea.id, title: idea.title, ok: false, error: error.message });
      logger.warn?.(`produce failed for ${idea.id}: ${error.message}`);
    }
  }
  return {
    produced,
    succeeded: produced.filter((entry) => entry.ok).length,
    failed: produced.filter((entry) => !entry.ok).length,
  };
}

/** Pipeline overview: counts per stage + recent renders. */
export async function factoryStatus({ store, recent = 5 } = {}) {
  const ideaStore = store ?? new IdeaStore();
  const ideas = await ideaStore.listIdeas();
  const counts = Object.fromEntries(IDEA_STATUSES.map((status) => [status, 0]));
  for (const idea of ideas) counts[idea.status] = (counts[idea.status] ?? 0) + 1;
  const recentRenders = ideas
    .filter((idea) => idea.status === 'rendered' || idea.status === 'posted')
    .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
    .slice(0, recent)
    .map((idea) => ({
      id: idea.id,
      title: idea.title,
      status: idea.status,
      updatedAt: idea.updatedAt,
      artifactDir: idea.notes?.match(/artifacts: (.+)$/)?.[1] ?? null,
    }));
  return { total: ideas.length, counts, recentRenders };
}
