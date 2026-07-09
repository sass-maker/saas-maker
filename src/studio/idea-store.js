import { mkdir, readFile, writeFile } from 'node:fs/promises';
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
      return Array.isArray(parsed.ideas) ? parsed.ideas : [];
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  }

  async persist(ideas) {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify({ ideas }, null, 2));
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
      status: STATUSES.includes(input.status) ? input.status : 'new',
      createdAt: now,
      updatedAt: now,
    };
    ideas.push(idea);
    await this.persist(ideas);
    return idea;
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
    return idea;
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
    return idea;
  }
}

export const IDEA_STATUSES = STATUSES;
