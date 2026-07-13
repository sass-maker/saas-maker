import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const STATUSES = ['new', 'scripted', 'rendered', 'posted'];

export class IdeaStore {
  constructor(options = {}) {
    this.filePath = path.resolve(options.filePath ?? process.env.STUDIO_IDEAS_FILE ?? './tmp/studio/ideas.json');
  }

  async load() {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed.ideas) ? parsed.ideas.map(freezeSourcePayload) : [];
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  }

  async persist(ideas) {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temporary, `${JSON.stringify({ ideas }, null, 2)}\n`);
    await rename(temporary, this.filePath);
  }

  async saveIdea(input) {
    if (!input || typeof input.title !== 'string' || !input.title.trim()) {
      throw new Error('idea requires a title');
    }
    const ideas = await this.load();
    const now = new Date().toISOString();
    const idea = {
      id: input.id ?? `idea_${now.replace(/\D/g, '').slice(0, 14)}_${ideas.length + 1}`,
      title: input.title.trim(),
      niche: input.niche ?? null,
      angle: input.angle ?? null,
      hook: input.hook ?? null,
      format: input.format ?? null,
      notes: input.notes ?? null,
      idempotencyKey: optionalString(input.idempotencyKey) ?? null,
      contentSource: input.contentSource ? structuredClone(input.contentSource) : null,
      approvedVariant: input.approvedVariant ? structuredClone(input.approvedVariant) : null,
      status: STATUSES.includes(input.status) ? input.status : 'new',
      createdAt: now,
      updatedAt: now,
    };
    ideas.push(idea);
    await this.persist(ideas);
    return freezeSourcePayload(idea);
  }

  async listIdeas({ status } = {}) {
    const ideas = await this.load();
    return status ? ideas.filter((idea) => idea.status === status) : ideas;
  }

  async updateIdea(id, patch = {}) {
    const ideas = await this.load();
    const idea = ideas.find((entry) => entry.id === id);
    if (!idea) throw new Error(`idea not found: ${id}`);
    if (patch.status !== undefined && !STATUSES.includes(patch.status)) {
      throw new Error(`unsupported idea status: ${patch.status} (expected ${STATUSES.join(', ')})`);
    }
    for (const key of ['status', 'niche', 'angle', 'hook', 'format', 'notes']) {
      if (patch[key] !== undefined) idea[key] = patch[key];
    }
    idea.updatedAt = new Date().toISOString();
    await this.persist(ideas);
    return freezeSourcePayload(idea);
  }

  async updateIdeaStatus(id, status) {
    if (!STATUSES.includes(status)) {
      throw new Error(`unsupported idea status: ${status} (expected ${STATUSES.join(', ')})`);
    }
    const ideas = await this.load();
    const idea = ideas.find((entry) => entry.id === id);
    if (!idea) throw new Error(`idea not found: ${id}`);
    idea.status = status;
    idea.updatedAt = new Date().toISOString();
    await this.persist(ideas);
    return freezeSourcePayload(idea);
  }
}

export const IDEA_STATUSES = STATUSES;

function optionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function freezeSourcePayload(idea) {
  if (idea?.contentSource) deepFreeze(idea.contentSource);
  if (idea?.approvedVariant) deepFreeze(idea.approvedVariant);
  return idea;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}
