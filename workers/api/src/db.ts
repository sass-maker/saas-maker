import { eq, and, desc } from 'drizzle-orm';
import { getDrizzle } from './drizzle';
import * as schema from './schema';
// FeedbackDatabase isn't actually exported from @saas-maker/db; the API DB
// surface has grown beyond what the shared block models. Until we extract a
// proper interface this is intentionally `any` so the rest of the API
// continues to typecheck.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FeedbackDatabase = any;
import type {
  AIRequestRecord,
  FeedbackRecord,
  FeedbackVote,
  ProjectRecord,
  UserRecord,
  UpvoteRecord,
  IndexRecord,
  DocumentRecord,
  WaitlistEntryRecord,

  TestimonialRecord,
  ChangelogEntryRecord,
  RoadmapItemRecord,
  AIMentionConfigDbRecord,
  AIMentionConfigRecord,
  AIMentionPromptRecord,
  AIMentionCheckRecord,
  AIMentionResultRecord,
} from '@saas-maker/shared-types';

export interface StandardsRow {
  id: string;
  owner_id: string;
  type: 'next' | 'vite' | 'node';
  eslint_rules: string; // JSON string
  tsconfig_options: string; // JSON string
  prettier_options: string; // JSON string
  updated_at: string;
}

export interface TaskRow {
  id: string; owner_id: string; project_slug: string | null;
  title: string; description: string | null;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  task_type: 'feature' | 'bug' | 'chore' | 'docs' | 'research' | 'cleanup' | 'other';
  size: 'xs' | 's' | 'm' | 'l' | 'xl';
  dependencies: string[];
  branch_name: string | null;
  pr_url: string | null;
  pr_status: 'none' | 'draft' | 'open' | 'merged' | 'closed';
  commit_sha: string | null;
  deployment_url: string | null;
  deployment_status: 'none' | 'pending' | 'success' | 'failed';
  blocked_on_user: boolean;
  has_changelog: boolean;
  created_at: string; updated_at: string;
}

export interface TaskCommentRow {
  id: string;
  owner_id: string;
  task_id: string;
  author_type: 'user' | 'agent';
  body: string;
  resolves_blocker: boolean;
  marks_done: boolean;
  created_at: string;
}

function parseTaskDependencies(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((id): id is string => typeof id === 'string');
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function hydrateTaskRow(row: Record<string, unknown> | null | undefined): TaskRow | null {
  if (!row) return null;
  return {
    ...row,
    dependencies: parseTaskDependencies(row.dependencies),
    blocked_on_user: row.blocked_on_user === true || row.blocked_on_user === 1,
    has_changelog: row.has_changelog === true || row.has_changelog === 1,
  } as TaskRow;
}

function hydrateTaskCommentRow(row: Record<string, unknown> | null | undefined): TaskCommentRow | null {
  if (!row) return null;
  return {
    ...row,
    resolves_blocker: row.resolves_blocker === true || row.resolves_blocker === 1,
    marks_done: row.marks_done === true || row.marks_done === 1,
  } as TaskCommentRow;
}

function sanitizeDependencyIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  for (const value of input) {
    if (typeof value === 'string' && value.trim()) seen.add(value.trim());
  }
  return Array.from(seen);
}

export interface SymphonyMemoryRow {
  owner_id: string;
  content: string;
  updated_at: string;
}

export interface SymphonyAuditLogRow {
  id: string;
  owner_id: string;
  task_id: string | null;
  action: string;
  actor_source: string;
  agent_profile: string | null;
  project_slug: string | null;
  metadata: string;
  created_at: string;
}

export interface SymphonyRunRow {
  id: string;
  owner_id: string;
  task_id: string | null;
  project_slug: string | null;
  agent_profile: string | null;
  model_profile: string | null;
  command_template: string;
  pid: number | null;
  status: string;
  workspace_path: string | null;
  prompt_path: string | null;
  terminal_hint: string | null;
  log_hint: string | null;
  cost_note: string | null;
  token_note: string | null;
  metadata: string;
  started_at: string;
  created_at: string;
}

export interface FleetMetadataRow {
  id: string;
  owner_id: string;
  slug: string;
  name: string;
  framework: string;
  framework_version: string | null;
  db: string;
  auth: string;
  deploy: string;
  test_frameworks: string;
  saasmaker_count: number;
  foundry_linked: number;
  last_scanned: string;
}

function parseViewerVote(value: unknown): FeedbackVote {
  if (value === 1 || value === '1') return 'up';
  if (value === -1 || value === '-1') return 'down';
  return null;
}

/**
 * Helper to cast D1 rows to specific types.
 * Since D1 returns generic objects, this provides a single point of casting
 * to avoid spreading 'as any' or 'as unknown as' throughout the logic.
 */
function mapRow<T>(row: Record<string, unknown> | null | undefined): T | null {
  if (!row) return null;
  return row as T;
}

function mapRows<T>(results: Record<string, unknown>[]): T[] {
  return results as T[];
}

function toFeedbackRecord(row: Record<string, unknown>): FeedbackRecord {
  return {
    ...mapRow<FeedbackRecord>(row)!,
    viewer_vote: parseViewerVote(row.viewer_vote),
  };
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

export function getDb(d1: D1Database): FeedbackDatabase {
  const drz = getDrizzle(d1);
  return {
    // --- Users ---
    async upsertUser(input) {
      await d1.prepare(
        `INSERT INTO users (id, email, name, avatar_url)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (email) DO UPDATE SET
           name = EXCLUDED.name,
           avatar_url = EXCLUDED.avatar_url`
      ).bind(input.id, input.email, input.name, input.avatar_url).run();
      // Fetch by id first; fall back to email in case of conflict with a different id
      const row = await d1.prepare(`SELECT * FROM users WHERE id = ?`).bind(input.id).first()
        ?? await d1.prepare(`SELECT * FROM users WHERE email = ?`).bind(input.email).first();
      return mapRow<UserRecord>(row)!;
    },

    async getUserById(id) {
      const row = await d1.prepare(`SELECT * FROM users WHERE id = ?`).bind(id).first();
      return mapRow<UserRecord>(row);
    },

    // --- Sessions ---
    async createSession(input) {
      await d1.prepare(
        `INSERT INTO sessions (token_hash, user_id, expires_at)
         VALUES (?, ?, ?)`
      ).bind(input.token_hash, input.user_id, input.expires_at).run();
    },

    async getSessionByTokenHash(tokenHash) {
      const row = await d1.prepare(
        `SELECT user_id, expires_at FROM sessions
         WHERE token_hash = ? AND expires_at > datetime('now')`
      ).bind(tokenHash).first();
      return row ? { user_id: row.user_id as string, expires_at: row.expires_at as string } : null;
    },

    async deleteSession(tokenHash) {
      await d1.prepare(`DELETE FROM sessions WHERE token_hash = ?`).bind(tokenHash).run();
    },

    // --- Projects ---
    async createProject(input) {
      const source = input.source || 'dashboard';
      await d1.prepare(
        `INSERT INTO projects (id, name, slug, api_key, owner_id, source)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(input.id, input.name, input.slug, input.api_key, input.owner_id, source).run();
      const row = await d1.prepare(`SELECT * FROM projects WHERE id = ?`).bind(input.id).first();
      return mapRow<ProjectRecord>(row)!;
    },

    async getProjectBySlug(slug) {
      const row = await d1.prepare(`SELECT * FROM projects WHERE slug = ?`).bind(slug).first();
      return mapRow<ProjectRecord>(row);
    },

    async getProjectByApiKey(apiKey) {
      const row = await d1.prepare(`SELECT * FROM projects WHERE api_key = ?`).bind(apiKey).first();
      return mapRow<ProjectRecord>(row);
    },

    async getProjectById(id) {
      const row = await d1.prepare(`SELECT * FROM projects WHERE id = ?`).bind(id).first();
      return mapRow<ProjectRecord>(row);
    },

    async listProjectsByOwner(ownerId, source) {
      // Migrated to Drizzle
      const filter = source === 'all'
        ? eq(schema.projects.owner_id, ownerId)
        : and(eq(schema.projects.owner_id, ownerId), eq(schema.projects.source, source || 'dashboard'));
      const rows = await drz.select().from(schema.projects).where(filter).orderBy(desc(schema.projects.created_at));
      return rows as unknown as ProjectRecord[];
    },

    async updateProject(id, input) {
      const sets: string[] = [];
      const values: unknown[] = [];
      if (input.name !== undefined) { sets.push('name = ?'); values.push(input.name); }
      if (input.embedding_model !== undefined) { sets.push('embedding_model = ?'); values.push(input.embedding_model); }
      if (input.readme !== undefined) { sets.push('readme = ?'); values.push(input.readme); }

      if (sets.length > 0) {
        const sql = `UPDATE projects SET ${sets.join(', ')} WHERE id = ?`;
        values.push(id);
        await d1.prepare(sql).bind(...values).run();
      }
      const row = await d1.prepare(`SELECT * FROM projects WHERE id = ?`).bind(id).first();
      return mapRow<ProjectRecord>(row);
    },

    async deleteProject(id) {
      const { meta } = await d1.prepare(`DELETE FROM projects WHERE id = ?`).bind(id).run();
      return (meta.changes ?? 0) > 0;
    },

    // --- Feedback ---
    async createFeedback(input) {
      const status = input.status ?? 'new';
      await d1.prepare(
        `INSERT INTO feedback (id, project_id, type, status, title, description, image_url, submitter_email, submitter_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(input.id, input.project_id, input.type, status, input.title, input.description, input.image_url, input.submitter_email, input.submitter_name).run();
      const row = await d1.prepare(`SELECT *, NULL AS viewer_vote FROM feedback WHERE id = ?`).bind(input.id).first();
      return toFeedbackRecord(row as unknown as Record<string, unknown>);
    },

    async getFeedbackById(id) {
      const row = await d1.prepare(`SELECT *, NULL AS viewer_vote FROM feedback WHERE id = ?`).bind(id).first();
      return row ? toFeedbackRecord(row as unknown as Record<string, unknown>) : null;
    },

    async listFeedback(projectId, query, userId) {
      // Migrated to Drizzle for the base filter; viewer_vote join kept as raw SQL
      // since Drizzle doesn't support dynamic LEFT JOIN ON conditions cleanly.
      const { type, status, sort = 'newest', page = 1, limit = 20 } = query;
      const offset = (page - 1) * limit;

      const conditions: string[] = ['f.project_id = ?'];
      const whereBinds: unknown[] = [projectId];
      if (type) { conditions.push('f.type = ?'); whereBinds.push(type); }
      if (status) { conditions.push('f.status = ?'); whereBinds.push(status); }

      const where = conditions.join(' AND ');
      const orderBy = sort === 'upvotes'
        ? 'f.upvote_count DESC, f.created_at DESC'
        : 'f.created_at DESC';

      // Count via Drizzle
      const filters = [eq(schema.feedback.project_id, projectId)];
      if (type) filters.push(eq(schema.feedback.type, type));
      if (status) filters.push(eq(schema.feedback.status, status));
      const countRows = await drz.select({ id: schema.feedback.id }).from(schema.feedback).where(and(...filters));
      const total = countRows.length;

      // Data — keep raw SQL for viewer_vote join which Drizzle can't express cleanly
      let rows: unknown[];
      if (userId) {
        const sql = `SELECT f.*, v.vote AS viewer_vote
           FROM feedback f
           LEFT JOIN feedback_votes v ON v.feedback_id = f.id AND v.user_id = ?
           WHERE ${where}
           ORDER BY ${orderBy}
           LIMIT ? OFFSET ?`;
        const { results } = await d1.prepare(sql).bind(userId, ...whereBinds, limit, offset).all();
        rows = results;
      } else {
        const { results } = await d1.prepare(
          `SELECT f.*, NULL AS viewer_vote
           FROM feedback f
           WHERE ${where}
           ORDER BY ${orderBy}
           LIMIT ? OFFSET ?`
        ).bind(...whereBinds, limit, offset).all();
        rows = results;
      }

      return {
        data: (rows as Record<string, unknown>[]).map(toFeedbackRecord),
        total,
      };
    },

    async updateFeedbackStatus(id, status) {
      await d1.prepare(
        `UPDATE feedback SET status = ? WHERE id = ?`
      ).bind(status, id).run();
      const row = await d1.prepare(`SELECT *, NULL AS viewer_vote FROM feedback WHERE id = ?`).bind(id).first();
      return row ? toFeedbackRecord(row as unknown as Record<string, unknown>) : null;
    },

    async deleteFeedback(id) {
      const { meta } = await d1.prepare(`DELETE FROM feedback WHERE id = ?`).bind(id).run();
      return (meta.changes ?? 0) > 0;
    },

    // --- Votes ---
    async setVote(input) {
      const existing = await d1.prepare(
        `SELECT * FROM feedback_votes WHERE feedback_id = ? AND user_id = ?`
      ).bind(input.feedback_id, input.user_id).first();

      if (!existing) {
        await d1.prepare(
          `INSERT INTO feedback_votes (id, feedback_id, user_id, vote) VALUES (?, ?, ?, ?)`
        ).bind(input.id, input.feedback_id, input.user_id, input.vote).run();
        if (input.vote === 1) {
          await d1.prepare(`UPDATE feedback SET upvote_count = upvote_count + 1 WHERE id = ?`).bind(input.feedback_id).run();
        } else {
          await d1.prepare(`UPDATE feedback SET downvote_count = downvote_count + 1 WHERE id = ?`).bind(input.feedback_id).run();
        }
        const inserted = await d1.prepare(`SELECT * FROM feedback_votes WHERE id = ?`).bind(input.id).first();
        return inserted as unknown as UpvoteRecord;
      }

      const existingVote = Number(existing.vote) as 1 | -1;
      if (existingVote === input.vote) {
        return existing as unknown as UpvoteRecord;
      }

      await d1.prepare(
        `UPDATE feedback_votes SET vote = ? WHERE id = ?`
      ).bind(input.vote, existing.id).run();

      if (existingVote === 1 && input.vote === -1) {
        await d1.prepare(
          `UPDATE feedback SET upvote_count = MAX(upvote_count - 1, 0), downvote_count = downvote_count + 1 WHERE id = ?`
        ).bind(input.feedback_id).run();
      } else if (existingVote === -1 && input.vote === 1) {
        await d1.prepare(
          `UPDATE feedback SET downvote_count = MAX(downvote_count - 1, 0), upvote_count = upvote_count + 1 WHERE id = ?`
        ).bind(input.feedback_id).run();
      }

      const updated = await d1.prepare(`SELECT * FROM feedback_votes WHERE id = ?`).bind(existing.id).first();
      return updated as unknown as UpvoteRecord;
    },

    async removeVote(feedbackId, userId) {
      const existing = await d1.prepare(
        `SELECT * FROM feedback_votes WHERE feedback_id = ? AND user_id = ?`
      ).bind(feedbackId, userId).first();
      if (!existing) return false;

      await d1.prepare(`DELETE FROM feedback_votes WHERE id = ?`).bind(existing.id).run();

      if (Number(existing.vote) === 1) {
        await d1.prepare(
          `UPDATE feedback SET upvote_count = MAX(upvote_count - 1, 0) WHERE id = ?`
        ).bind(feedbackId).run();
      } else {
        await d1.prepare(
          `UPDATE feedback SET downvote_count = MAX(downvote_count - 1, 0) WHERE id = ?`
        ).bind(feedbackId).run();
      }

      return true;
    },

    async hasUpvoted(feedbackId, userId) {
      const row = await d1.prepare(
        `SELECT 1 FROM feedback_votes WHERE feedback_id = ? AND user_id = ? AND vote = 1`
      ).bind(feedbackId, userId).first();
      return !!row;
    },

    async hasDownvoted(feedbackId, userId) {
      const row = await d1.prepare(
        `SELECT 1 FROM feedback_votes WHERE feedback_id = ? AND user_id = ? AND vote = -1`
      ).bind(feedbackId, userId).first();
      return !!row;
    },

    async getUserVote(feedbackId, userId) {
      const row = await d1.prepare(
        `SELECT vote FROM feedback_votes WHERE feedback_id = ? AND user_id = ?`
      ).bind(feedbackId, userId).first();
      return parseViewerVote(row?.vote);
    },

    // --- Vector Memory: Indexes ---
    async createIndex(input) {
      await d1.prepare(
        `INSERT INTO knowledge_indexes (id, project_id, name, external_id) VALUES (?, ?, ?, ?)`
      ).bind(input.id, input.project_id, input.name, input.external_id).run();
      const row = await d1.prepare(`SELECT * FROM knowledge_indexes WHERE id = ?`).bind(input.id).first();
      return row as unknown as IndexRecord;
    },

    async getIndexById(id) {
      const row = await d1.prepare(`SELECT * FROM knowledge_indexes WHERE id = ?`).bind(id).first();
      return (row as unknown as IndexRecord) || null;
    },

    async listIndexesByProject(projectId) {
      const { results } = await d1.prepare(
        `SELECT i.*, COALESCE(d.cnt, 0) AS document_count
         FROM knowledge_indexes i
         LEFT JOIN (SELECT index_id, COUNT(*) AS cnt FROM documents GROUP BY index_id) d
           ON d.index_id = i.id
         WHERE i.project_id = ?
         ORDER BY i.created_at DESC`
      ).bind(projectId).all();
      return results as unknown as (IndexRecord & { document_count: number })[];
    },

    async deleteIndex(id) {
      const { meta } = await d1.prepare(`DELETE FROM knowledge_indexes WHERE id = ?`).bind(id).run();
      return (meta.changes ?? 0) > 0;
    },

    // --- Vector Memory: Documents ---
    async createDocument(input) {
      await d1.prepare(
        `INSERT INTO documents (id, index_id, content, metadata) VALUES (?, ?, ?, ?)`
      ).bind(input.id, input.index_id, input.content, JSON.stringify(input.metadata)).run();
      const row = await d1.prepare(`SELECT * FROM documents WHERE id = ?`).bind(input.id).first();
      return row as unknown as DocumentRecord;
    },

    async getDocumentById(id) {
      const row = await d1.prepare(`SELECT * FROM documents WHERE id = ?`).bind(id).first();
      return (row as unknown as DocumentRecord) || null;
    },

    async listDocumentsByIndex(indexId, page, limit) {
      const offset = (page - 1) * limit;
      const countRow = await d1.prepare(
        `SELECT COUNT(*) AS total FROM documents WHERE index_id = ?`
      ).bind(indexId).first();
      const { results } = await d1.prepare(
        `SELECT * FROM documents WHERE index_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`
      ).bind(indexId, limit, offset).all();
      return { data: results as unknown as DocumentRecord[], total: (countRow?.total as number) || 0 };
    },

    async deleteDocument(id) {
      const { meta } = await d1.prepare(`DELETE FROM documents WHERE id = ?`).bind(id).run();
      return (meta.changes ?? 0) > 0;
    },

    // --- Vector Memory: Chunks ---
    async createChunks(chunks) {
      if (chunks.length === 0) return 0;
      const stmts = chunks.map(c =>
        d1.prepare(
          `INSERT INTO document_chunks (id, document_id, index_id, content, embedding, chunk_index) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(c.id, c.document_id, c.index_id, c.content, JSON.stringify(c.embedding), c.chunk_index)
      );
      await d1.batch(stmts);
      return chunks.length;
    },

    async searchChunks(indexId, queryEmbedding, topK) {
      const { results: chunkRows } = await d1.prepare(
        `SELECT c.document_id, c.content, c.embedding, d.metadata
         FROM document_chunks c
         JOIN documents d ON d.id = c.document_id
         WHERE c.index_id = ?`
      ).bind(indexId).all();

      const scored = chunkRows.map(row => {
        const storedEmbedding: number[] = JSON.parse(row.embedding as string);
        const score = cosineSimilarity(queryEmbedding, storedEmbedding);
        const metadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {});
        return {
          document_id: row.document_id as string,
          content: row.content as string,
          score,
          metadata: metadata as Record<string, unknown>,
        };
      });

      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, topK);
    },

    async deleteChunksByDocument(documentId) {
      const { meta } = await d1.prepare(`DELETE FROM document_chunks WHERE document_id = ?`).bind(documentId).run();
      return (meta.changes ?? 0) > 0;
    },

    // --- Waitlist ---
    async createWaitlistEntry(input) {
      const posRow = await d1.prepare(
        `SELECT COALESCE(MAX(position), 0) + 1 AS next_pos FROM waitlist_entries WHERE project_id = ?`
      ).bind(input.project_id).first();
      const nextPos = (posRow?.next_pos as number) || 1;
      await d1.prepare(
        `INSERT INTO waitlist_entries (id, project_id, email, name, position) VALUES (?, ?, ?, ?, ?)`
      ).bind(input.id, input.project_id, input.email, input.name, nextPos).run();
      const row = await d1.prepare(`SELECT * FROM waitlist_entries WHERE id = ?`).bind(input.id).first();
      return row as unknown as WaitlistEntryRecord;
    },

    async getWaitlistCount(projectId) {
      const row = await d1.prepare(
        `SELECT COUNT(*) AS total FROM waitlist_entries WHERE project_id = ?`
      ).bind(projectId).first();
      return (row?.total as number) || 0;
    },

    async listWaitlistEntries(projectId, page, limit) {
      const offset = (page - 1) * limit;
      const countRow = await d1.prepare(
        `SELECT COUNT(*) AS total FROM waitlist_entries WHERE project_id = ?`
      ).bind(projectId).first();
      const { results } = await d1.prepare(
        `SELECT * FROM waitlist_entries WHERE project_id = ? ORDER BY position ASC LIMIT ? OFFSET ?`
      ).bind(projectId, limit, offset).all();
      return { data: results as unknown as WaitlistEntryRecord[], total: (countRow?.total as number) || 0 };
    },

    async deleteWaitlistEntry(id) {
      const { meta } = await d1.prepare(`DELETE FROM waitlist_entries WHERE id = ?`).bind(id).run();
      return (meta.changes ?? 0) > 0;
    },

    // --- Testimonials ---
    async createTestimonial(input: {
      id: string;
      project_id: string;
      author_name: string;
      author_email: string;
      author_avatar_url: string | null;
      author_title: string | null;
      content: string;
      rating: number;
      image_url: string | null;
      tweet_url: string | null;
    }) {
      await d1.prepare(
        `INSERT INTO testimonials (id, project_id, author_name, author_email, author_avatar_url, author_title, content, rating, image_url, tweet_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(input.id, input.project_id, input.author_name, input.author_email, input.author_avatar_url, input.author_title, input.content, input.rating, input.image_url, input.tweet_url).run();
      const row = await d1.prepare(`SELECT * FROM testimonials WHERE id = ?`).bind(input.id).first();
      return row as unknown as TestimonialRecord;
    },

    async listApprovedTestimonials(projectId: string, limit = 50, sort: 'newest' | 'rating' = 'newest') {
      const orderClause = sort === 'rating' ? 'rating DESC, created_at DESC' : 'created_at DESC';
      const { results } = await d1.prepare(
        `SELECT * FROM testimonials
         WHERE project_id = ? AND status = 'approved'
         ORDER BY ${orderClause}
         LIMIT ?`
      ).bind(projectId, limit).all();
      return results as unknown as TestimonialRecord[];
    },

    async listAllTestimonials(projectId: string, page: number, limit: number) {
      const offset = (page - 1) * limit;
      const countRow = await d1.prepare(
        `SELECT COUNT(*) AS total FROM testimonials WHERE project_id = ?`
      ).bind(projectId).first();
      const { results } = await d1.prepare(
        `SELECT * FROM testimonials WHERE project_id = ?
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`
      ).bind(projectId, limit, offset).all();
      return { data: results as unknown as TestimonialRecord[], total: (countRow?.total as number) || 0 };
    },

    async getTestimonialStats(projectId: string) {
      const row = await d1.prepare(
        `SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
           SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
           COALESCE(AVG(CASE WHEN status = 'approved' THEN rating ELSE NULL END), 0) AS avg_rating
         FROM testimonials WHERE project_id = ?`
      ).bind(projectId).first();
      return {
        total: (row?.total as number) || 0,
        pending: (row?.pending as number) || 0,
        approved: (row?.approved as number) || 0,
        avg_rating: (row?.avg_rating as number) || 0,
      };
    },

    async updateTestimonialStatus(id: string, status: string) {
      await d1.prepare(
        `UPDATE testimonials SET status = ? WHERE id = ?`
      ).bind(status, id).run();
      const row = await d1.prepare(`SELECT * FROM testimonials WHERE id = ?`).bind(id).first();
      return (row as unknown as TestimonialRecord) || null;
    },

    async deleteTestimonial(id: string) {
      const { meta } = await d1.prepare(`DELETE FROM testimonials WHERE id = ?`).bind(id).run();
      return (meta.changes ?? 0) > 0;
    },

    async getTestimonialById(id: string) {
      const row = await d1.prepare(`SELECT * FROM testimonials WHERE id = ?`).bind(id).first();
      return (row as unknown as TestimonialRecord) || null;
    },

    // --- CLI Auth ---
    async createCliAuthCode(code: string) {
      await d1.prepare(
        `INSERT INTO cli_auth_codes (code, expires_at) VALUES (?, datetime('now', '+10 minutes'))`
      ).bind(code).run();
    },

    async getCliAuthCode(code: string) {
      const row = await d1.prepare(`SELECT * FROM cli_auth_codes WHERE code = ?`).bind(code).first();
      return mapRow<{ code: string; user_id: string | null; status: string; token: string | null; expires_at: string }>(row) || undefined;
    },

    async approveCliAuthCode(code: string, userId: string, token: string) {
      await d1.prepare(
        `UPDATE cli_auth_codes SET status = 'approved', user_id = ?, token = ? WHERE code = ?`
      ).bind(userId, token, code).run();
    },

    async deleteCliAuthCode(code: string) {
      await d1.prepare(`DELETE FROM cli_auth_codes WHERE code = ?`).bind(code).run();
    },

    async createCliToken(token: string, userId: string) {
      await d1.prepare(`INSERT INTO cli_tokens (token, user_id) VALUES (?, ?)`).bind(token, userId).run();
    },

    async getCliTokenUser(token: string) {
      const row = await d1.prepare(`SELECT user_id FROM cli_tokens WHERE token = ?`).bind(token).first();
      return row as unknown as { user_id: string } | undefined;
    },

    // --- Changelog ---
    async createChangelogEntry(input) {
      const publishedInt = input.published ? 1 : 0;
      await d1.prepare(
        `INSERT INTO changelog_entries (id, project_id, title, content, version, type, published, published_at, source, task_id, agent, evidence, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), COALESCE(?, datetime('now')))`
      ).bind(input.id, input.project_id, input.title, input.content, input.version, input.type, publishedInt, input.published_at, input.source ?? null, input.task_id ?? null, input.agent ?? null, input.evidence ?? null, input.created_at ?? null, input.updated_at ?? input.created_at ?? null).run();
      const row = await d1.prepare(`SELECT * FROM changelog_entries WHERE id = ?`).bind(input.id).first();
      return row as unknown as ChangelogEntryRecord;
    },

    async updateChangelogEntry(id, input) {
      const sets: string[] = [];
      const values: unknown[] = [];
      if (input.title !== undefined) { sets.push('title = ?'); values.push(input.title); }
      if (input.content !== undefined) { sets.push('content = ?'); values.push(input.content); }
      if (input.version !== undefined) { sets.push('version = ?'); values.push(input.version); }
      if (input.type !== undefined) { sets.push('type = ?'); values.push(input.type); }
      if (input.published !== undefined) {
        sets.push('published = ?');
        values.push(input.published ? 1 : 0);
        if (input.published) {
          sets.push("published_at = COALESCE(published_at, datetime('now'))");
        } else {
          sets.push('published_at = NULL');
        }
      }
      if (input.source !== undefined) { sets.push('source = ?'); values.push(input.source); }
      if (input.task_id !== undefined) { sets.push('task_id = ?'); values.push(input.task_id); }
      if (input.agent !== undefined) { sets.push('agent = ?'); values.push(input.agent); }
      if (input.evidence !== undefined) { sets.push('evidence = ?'); values.push(input.evidence); }
      sets.push("updated_at = datetime('now')");

      const sql = `UPDATE changelog_entries SET ${sets.join(', ')} WHERE id = ?`;
      values.push(id);
      await d1.prepare(sql).bind(...values).run();
      const row = await d1.prepare(`SELECT * FROM changelog_entries WHERE id = ?`).bind(id).first();
      return (row as unknown as ChangelogEntryRecord) || null;
    },

    async deleteChangelogEntry(id) {
      const { meta } = await d1.prepare(`DELETE FROM changelog_entries WHERE id = ?`).bind(id).run();
      return (meta.changes ?? 0) > 0;
    },

    async getChangelogEntryById(id) {
      const row = await d1.prepare(`SELECT * FROM changelog_entries WHERE id = ?`).bind(id).first();
      return (row as unknown as ChangelogEntryRecord) || null;
    },

    async hasChangelogEntryForTask(taskId: string): Promise<boolean> {
      const row = await d1.prepare(
        `SELECT id FROM changelog_entries WHERE task_id = ? LIMIT 1`
      ).bind(taskId).first();
      return row !== null;
    },

    async listChangelogEntries(projectId, page, limit) {
      const offset = (page - 1) * limit;
      const countRow = await d1.prepare(
        `SELECT COUNT(*) AS total FROM changelog_entries WHERE project_id = ?`
      ).bind(projectId).first();
      const { results } = await d1.prepare(
        `SELECT * FROM changelog_entries WHERE project_id = ?
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`
      ).bind(projectId, limit, offset).all();
      return { data: results as unknown as ChangelogEntryRecord[], total: (countRow?.total as number) || 0 };
    },

    async listPublishedChangelog(projectId, limit) {
      const { results } = await d1.prepare(
        `SELECT * FROM changelog_entries
         WHERE project_id = ? AND published = 1
         ORDER BY published_at DESC
         LIMIT ?`
      ).bind(projectId, limit).all();
      return results as unknown as ChangelogEntryRecord[];
    },

    async getChangelogStats(projectId) {
      const row = await d1.prepare(
        `SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN published = 1 THEN 1 ELSE 0 END) AS published,
           SUM(CASE WHEN published = 0 THEN 1 ELSE 0 END) AS drafts
         FROM changelog_entries WHERE project_id = ?`
      ).bind(projectId).first();
      return {
        total: (row?.total as number) || 0,
        published: (row?.published as number) || 0,
        drafts: (row?.drafts as number) || 0,
      };
    },

    async listFleetDailyChangelog(_userId: string, date: string) {
      const { results } = await d1.prepare(
        `SELECT ce.*, p.slug AS project_slug, p.name AS project_name
         FROM changelog_entries ce
         JOIN projects p ON ce.project_id = p.id
         WHERE date(datetime(ce.created_at, '+5 hours', '+30 minutes')) = ?
           AND ce.type IN ('feature', 'fix')
         ORDER BY ce.created_at DESC`
      ).bind(date).all();
      return results as unknown as import('@saas-maker/shared-types').FleetChangelogEntry[];
    },

    // --- AI Gateway ---

    async getProjectAIConfig(projectId: string): Promise<{ ai_base_url: string | null; ai_api_key: string | null; ai_model: string | null }> {
      const row = await d1.prepare(
        `SELECT ai_base_url, ai_api_key, ai_model FROM projects WHERE id = ?`
      ).bind(projectId).first();
      if (!row) throw new Error('Project not found');
      return { ai_base_url: row.ai_base_url as string | null, ai_api_key: row.ai_api_key as string | null, ai_model: row.ai_model as string | null };
    },

    async updateProjectAIConfig(projectId: string, config: { ai_base_url: string; ai_api_key?: string; ai_model: string }): Promise<void> {
      const existing = await d1.prepare(
        `SELECT ai_api_key FROM projects WHERE id = ?`
      ).bind(projectId).first();
      if (!existing) throw new Error('Project not found');
      const apiKey = config.ai_api_key ?? existing.ai_api_key;
      await d1.prepare(
        `UPDATE projects SET ai_base_url = ?, ai_api_key = ?, ai_model = ? WHERE id = ?`
      ).bind(config.ai_base_url, apiKey, config.ai_model, projectId).run();
    },

    async deleteProjectAIConfig(projectId: string): Promise<void> {
      await d1.prepare(
        `UPDATE projects SET ai_base_url = NULL, ai_api_key = NULL, ai_model = NULL WHERE id = ?`
      ).bind(projectId).run();
    },

    async logAIRequest(params: {
      id: string;
      projectId: string;
      endpoint: string;
      model: string;
      status: 'success' | 'error' | 'timeout';
      latencyMs: number | null;
      inputTokens: number | null;
      outputTokens: number | null;
      errorMessage: string | null;
    }): Promise<void> {
      await d1.prepare(
        `INSERT INTO ai_requests (id, project_id, endpoint, model, status, latency_ms, input_tokens, output_tokens, error_message)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(params.id, params.projectId, params.endpoint, params.model, params.status, params.latencyMs, params.inputTokens, params.outputTokens, params.errorMessage).run();
    },

    async getAIUsageStats(projectId: string, daysBack: number = 30): Promise<{ total_requests: number; success_count: number; error_count: number; avg_latency_ms: number | null; total_input_tokens: number; total_output_tokens: number }> {
      const sinceDate = new Date(Date.now() - daysBack * 86400000).toISOString();
      const row = await d1.prepare(
        `SELECT
           COUNT(*) AS total_requests,
           SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS success_count,
           SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS error_count,
           AVG(latency_ms) AS avg_latency_ms,
           COALESCE(SUM(input_tokens), 0) AS total_input_tokens,
           COALESCE(SUM(output_tokens), 0) AS total_output_tokens
         FROM ai_requests
         WHERE project_id = ? AND created_at > ?`
      ).bind(projectId, sinceDate).first();
      return {
        total_requests: (row?.total_requests as number) || 0,
        success_count: (row?.success_count as number) || 0,
        error_count: (row?.error_count as number) || 0,
        avg_latency_ms: row?.avg_latency_ms != null ? Math.round(row.avg_latency_ms as number) : null,
        total_input_tokens: (row?.total_input_tokens as number) || 0,
        total_output_tokens: (row?.total_output_tokens as number) || 0,
      };
    },

    async listAIRequests(projectId: string, limit: number = 50, offset: number = 0): Promise<{ data: AIRequestRecord[]; total: number }> {
      const countRow = await d1.prepare(
        `SELECT COUNT(*) AS total FROM ai_requests WHERE project_id = ?`
      ).bind(projectId).first();
      const { results } = await d1.prepare(
        `SELECT * FROM ai_requests WHERE project_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`
      ).bind(projectId, limit, offset).all();
      return { data: results as unknown as AIRequestRecord[], total: (countRow?.total as number) || 0 };
    },

    // --- Roadmap ---
    async createRoadmapItem(input) {
      const publicInt = input.public ? 1 : 0;
      await d1.prepare(
        `INSERT INTO roadmap_items (id, project_id, feedback_id, title, description, "column", position, public)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(input.id, input.project_id, input.feedback_id, input.title, input.description, input.column, input.position, publicInt).run();
      const row = await d1.prepare(`SELECT * FROM roadmap_items WHERE id = ?`).bind(input.id).first();
      return row as unknown as RoadmapItemRecord;
    },

    async getRoadmapItemById(id) {
      const row = await d1.prepare(`SELECT * FROM roadmap_items WHERE id = ?`).bind(id).first();
      return (row as unknown as RoadmapItemRecord) || null;
    },

    async listRoadmapItems(projectId, publicOnly = false) {
      if (publicOnly) {
        const { results } = await d1.prepare(
          `SELECT * FROM roadmap_items
           WHERE project_id = ? AND public = 1
           ORDER BY "column", position`
        ).bind(projectId).all();
        return results as unknown as RoadmapItemRecord[];
      }
      const { results } = await d1.prepare(
        `SELECT * FROM roadmap_items
         WHERE project_id = ?
         ORDER BY "column", position`
      ).bind(projectId).all();
      return results as unknown as RoadmapItemRecord[];
    },

    async updateRoadmapItem(id, input) {
      const sets: string[] = [];
      const values: unknown[] = [];
      if (input.title !== undefined) { sets.push('title = ?'); values.push(input.title); }
      if (input.description !== undefined) { sets.push('description = ?'); values.push(input.description); }
      if (input.column !== undefined) { sets.push('"column" = ?'); values.push(input.column); }
      if (input.position !== undefined) { sets.push('position = ?'); values.push(input.position); }
      if (input.public !== undefined) { sets.push('public = ?'); values.push(input.public ? 1 : 0); }
      sets.push("updated_at = datetime('now')");

      const sql = `UPDATE roadmap_items SET ${sets.join(', ')} WHERE id = ?`;
      values.push(id);
      await d1.prepare(sql).bind(...values).run();
      const row = await d1.prepare(`SELECT * FROM roadmap_items WHERE id = ?`).bind(id).first();
      return (row as unknown as RoadmapItemRecord) || null;
    },

    async deleteRoadmapItem(id) {
      const { meta } = await d1.prepare(`DELETE FROM roadmap_items WHERE id = ?`).bind(id).run();
      return (meta.changes ?? 0) > 0;
    },

    async batchUpdateRoadmapPositions(items) {
      const stmts = items.map(item =>
        d1.prepare(
          `UPDATE roadmap_items SET "column" = ?, position = ?, updated_at = datetime('now') WHERE id = ?`
        ).bind(item.column, item.position, item.id)
      );
      if (stmts.length > 0) {
        await d1.batch(stmts);
      }
    },

    async getNextRoadmapPosition(projectId, column) {
      const row = await d1.prepare(
        `SELECT COALESCE(MAX(position), -1) + 1 AS next_pos
         FROM roadmap_items
         WHERE project_id = ? AND "column" = ?`
      ).bind(projectId, column).first();
      return (row as unknown as { next_pos: number }).next_pos as number;
    },

    // --- Roadmap Votes ---
    async setRoadmapVote(input) {
      await d1.prepare(
        `INSERT INTO roadmap_votes (id, roadmap_item_id, user_identifier, vote)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (roadmap_item_id, user_identifier) DO UPDATE SET vote = ?`
      ).bind(input.id, input.roadmap_item_id, input.user_identifier, input.vote, input.vote).run();
      const counts = await d1.prepare(
        `SELECT
           COALESCE(SUM(CASE WHEN vote = 1 THEN 1 ELSE 0 END), 0) AS up,
           COALESCE(SUM(CASE WHEN vote = -1 THEN 1 ELSE 0 END), 0) AS down
         FROM roadmap_votes WHERE roadmap_item_id = ?`
      ).bind(input.roadmap_item_id).first();
      const castCounts = counts as unknown as { up: number; down: number };
      await d1.prepare(
        `UPDATE roadmap_items SET upvote_count = ?, downvote_count = ? WHERE id = ?`
      ).bind(castCounts.up, castCounts.down, input.roadmap_item_id).run();
    },

    async removeRoadmapVote(roadmapItemId, userIdentifier) {
      const { meta } = await d1.prepare(
        `DELETE FROM roadmap_votes WHERE roadmap_item_id = ? AND user_identifier = ?`
      ).bind(roadmapItemId, userIdentifier).run();
      if ((meta.changes ?? 0) > 0) {
        const counts = await d1.prepare(
          `SELECT
             COALESCE(SUM(CASE WHEN vote = 1 THEN 1 ELSE 0 END), 0) AS up,
             COALESCE(SUM(CASE WHEN vote = -1 THEN 1 ELSE 0 END), 0) AS down
           FROM roadmap_votes WHERE roadmap_item_id = ?`
        ).bind(roadmapItemId).first();
        const castCounts = counts as unknown as { up: number; down: number };
        await d1.prepare(
          `UPDATE roadmap_items SET upvote_count = ?, downvote_count = ? WHERE id = ?`
        ).bind(castCounts.up, castCounts.down, roadmapItemId).run();
      }
      return (meta.changes ?? 0) > 0;
    },

    async getRoadmapVote(roadmapItemId, userIdentifier) {
      const row = await d1.prepare(
        `SELECT vote FROM roadmap_votes WHERE roadmap_item_id = ? AND user_identifier = ?`
      ).bind(roadmapItemId, userIdentifier).first();
      if (!row) return null;
      return (row as unknown as { vote: number }).vote === 1 ? 1 : -1;
    },

    // --- AI Mention Check ---
    async upsertAIMentionConfig(input) {
      await d1.prepare(
        `INSERT INTO ai_mention_configs (id, project_id, brand_name, brand_aliases, brand_url, competitors, platforms, openai_api_key, anthropic_api_key, google_api_key, perplexity_api_key)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (project_id) DO UPDATE SET
           brand_name = EXCLUDED.brand_name,
           brand_aliases = EXCLUDED.brand_aliases,
           brand_url = EXCLUDED.brand_url,
           competitors = EXCLUDED.competitors,
           platforms = EXCLUDED.platforms,
           openai_api_key = COALESCE(EXCLUDED.openai_api_key, ai_mention_configs.openai_api_key),
           anthropic_api_key = COALESCE(EXCLUDED.anthropic_api_key, ai_mention_configs.anthropic_api_key),
           google_api_key = COALESCE(EXCLUDED.google_api_key, ai_mention_configs.google_api_key),
           perplexity_api_key = COALESCE(EXCLUDED.perplexity_api_key, ai_mention_configs.perplexity_api_key),
           updated_at = datetime('now')`
      ).bind(
        input.id, input.project_id, input.brand_name, input.brand_aliases,
        input.brand_url, input.competitors, input.platforms,
        input.openai_api_key, input.anthropic_api_key, input.google_api_key, input.perplexity_api_key
      ).run();
      const row = await d1.prepare(`SELECT * FROM ai_mention_configs WHERE project_id = ?`).bind(input.project_id).first();
      return row as unknown as AIMentionConfigDbRecord;
    },

    async getAIMentionConfig(projectId) {
      const row = await d1.prepare(`SELECT * FROM ai_mention_configs WHERE project_id = ?`).bind(projectId).first();
      return (row as unknown as AIMentionConfigDbRecord) || null;
    },

    async deleteAIMentionConfig(projectId) {
      const { meta } = await d1.prepare(`DELETE FROM ai_mention_configs WHERE project_id = ?`).bind(projectId).run();
      return (meta.changes ?? 0) > 0;
    },

    async createAIMentionPrompt(input) {
      await d1.prepare(
        `INSERT INTO ai_mention_prompts (id, project_id, prompt_text, category) VALUES (?, ?, ?, ?)`
      ).bind(input.id, input.project_id, input.prompt_text, input.category).run();
      const row = await d1.prepare(`SELECT * FROM ai_mention_prompts WHERE id = ?`).bind(input.id).first();
      return row as unknown as AIMentionPromptRecord;
    },

    async listAIMentionPrompts(projectId) {
      const { results } = await d1.prepare(
        `SELECT * FROM ai_mention_prompts WHERE project_id = ? ORDER BY created_at ASC`
      ).bind(projectId).all();
      return results as unknown as AIMentionPromptRecord[];
    },

    async deleteAIMentionPrompt(id) {
      const { meta } = await d1.prepare(`DELETE FROM ai_mention_prompts WHERE id = ?`).bind(id).run();
      return (meta.changes ?? 0) > 0;
    },

    async countAIMentionPrompts(projectId) {
      const row = await d1.prepare(
        `SELECT COUNT(*) AS total FROM ai_mention_prompts WHERE project_id = ?`
      ).bind(projectId).first();
      return (row?.total as number) || 0;
    },

    async createAIMentionCheck(input) {
      await d1.prepare(
        `INSERT INTO ai_mention_checks (id, project_id, total_queries) VALUES (?, ?, ?)`
      ).bind(input.id, input.project_id, input.total_queries).run();
      const row = await d1.prepare(`SELECT * FROM ai_mention_checks WHERE id = ?`).bind(input.id).first();
      return row as unknown as AIMentionCheckRecord;
    },

    async updateAIMentionCheck(id, input) {
      const sets: string[] = [];
      const values: unknown[] = [];
      if (input.status !== undefined) { sets.push('status = ?'); values.push(input.status); }
      if (input.completed_queries !== undefined) { sets.push('completed_queries = ?'); values.push(input.completed_queries); }
      if (input.brand_mention_rate !== undefined) { sets.push('brand_mention_rate = ?'); values.push(input.brand_mention_rate); }
      if (input.summary !== undefined) { sets.push('summary = ?'); values.push(input.summary); }
      if (input.completed_at !== undefined) { sets.push('completed_at = ?'); values.push(input.completed_at); }
      if (sets.length === 0) return null;
      const sql = `UPDATE ai_mention_checks SET ${sets.join(', ')} WHERE id = ?`;
      values.push(id);
      await d1.prepare(sql).bind(...values).run();
      const row = await d1.prepare(`SELECT * FROM ai_mention_checks WHERE id = ?`).bind(id).first();
      return (row as unknown as AIMentionCheckRecord) || null;
    },

    async listAIMentionChecks(projectId, limit = 10) {
      const { results } = await d1.prepare(
        `SELECT * FROM ai_mention_checks WHERE project_id = ? ORDER BY created_at DESC LIMIT ?`
      ).bind(projectId, limit).all();
      return results as unknown as AIMentionCheckRecord[];
    },

    async getAIMentionCheckById(id) {
      const row = await d1.prepare(`SELECT * FROM ai_mention_checks WHERE id = ?`).bind(id).first();
      return (row as unknown as AIMentionCheckRecord) || null;
    },

    async createAIMentionResult(input) {
      await d1.prepare(
        `INSERT INTO ai_mention_results (id, check_id, project_id, prompt_id, platform, model, response_text, brand_mentioned, brand_sentiment, brand_position, competitors_mentioned, citations, brand_cited, latency_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        input.id, input.check_id, input.project_id, input.prompt_id,
        input.platform, input.model, input.response_text,
        input.brand_mentioned ? 1 : 0, input.brand_sentiment, input.brand_position,
        input.competitors_mentioned, input.citations,
        input.brand_cited ? 1 : 0, input.latency_ms
      ).run();
    },

    async listAIMentionResults(checkId) {
      const { results } = await d1.prepare(
        `SELECT * FROM ai_mention_results WHERE check_id = ? ORDER BY created_at ASC`
      ).bind(checkId).all();
      return results as unknown as AIMentionResultRecord[];
    },

    // --- Standards ---
    async getStandards(ownerId: string, type: string): Promise<StandardsRow | null> {
      const row = await d1.prepare(
        `SELECT * FROM standards WHERE owner_id = ? AND type = ?`
      ).bind(ownerId, type).first();
      return mapRow<StandardsRow>(row);
    },

    async upsertStandards(
      ownerId: string,
      type: string,
      eslintRules: object,
      tsconfigOptions: object,
      prettierOptions: object,
    ): Promise<StandardsRow> {
      const id = crypto.randomUUID();
      await d1.prepare(
        `INSERT INTO standards (id, owner_id, type, eslint_rules, tsconfig_options, prettier_options, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT (owner_id, type) DO UPDATE SET
           eslint_rules = EXCLUDED.eslint_rules,
           tsconfig_options = EXCLUDED.tsconfig_options,
           prettier_options = EXCLUDED.prettier_options,
           updated_at = datetime('now')`
      ).bind(id, ownerId, type, JSON.stringify(eslintRules), JSON.stringify(tsconfigOptions), JSON.stringify(prettierOptions)).run();
      const row = await d1.prepare(
        `SELECT * FROM standards WHERE owner_id = ? AND type = ?`
      ).bind(ownerId, type).first();
      return mapRow<StandardsRow>(row)!;
    },

    async getAllStandardsByOwner(ownerId: string): Promise<StandardsRow[]> {
      const { results } = await d1.prepare(
        `SELECT * FROM standards WHERE owner_id = ? ORDER BY type ASC`
      ).bind(ownerId).all();
      return mapRows<StandardsRow>(results);
    },

    // --- Fleet Metadata ---
    async upsertFleetMetadata(ownerId: string, project: Omit<FleetMetadataRow, 'id' | 'owner_id'>): Promise<void> {
      await d1.prepare(`
        INSERT INTO fleet_metadata (id, owner_id, slug, name, framework, framework_version, db, auth, deploy, test_frameworks, saasmaker_count, foundry_linked, last_scanned)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT (owner_id, slug) DO UPDATE SET
          name = EXCLUDED.name, framework = EXCLUDED.framework,
          framework_version = EXCLUDED.framework_version, db = EXCLUDED.db,
          auth = EXCLUDED.auth, deploy = EXCLUDED.deploy,
          test_frameworks = EXCLUDED.test_frameworks,
          saasmaker_count = EXCLUDED.saasmaker_count,
          foundry_linked = EXCLUDED.foundry_linked,
          last_scanned = datetime('now')
      `).bind(
        crypto.randomUUID(), ownerId, project.slug, project.name,
        project.framework, project.framework_version ?? null,
        project.db, project.auth, project.deploy,
        project.test_frameworks, project.saasmaker_count, project.foundry_linked ? 1 : 0
      ).run();
    },

    async getFleetMetadata(ownerId: string): Promise<FleetMetadataRow[]> {
      const results = await d1.prepare(
        `SELECT * FROM fleet_metadata WHERE owner_id = ? ORDER BY name ASC`
      ).bind(ownerId).all();
      return mapRows<FleetMetadataRow>(results.results ?? []);
    },

    async deleteFleetMetadataBySlugs(ownerId: string, slugs: string[]): Promise<number> {
      const uniqueSlugs = [...new Set(slugs.map((slug) => slug.trim()).filter(Boolean))];
      if (uniqueSlugs.length === 0) return 0;
      const placeholders = uniqueSlugs.map(() => '?').join(', ');
      const result = await d1.prepare(
        `DELETE FROM fleet_metadata WHERE owner_id = ? AND slug IN (${placeholders})`
      ).bind(ownerId, ...uniqueSlugs).run();
      return result.meta.changes ?? 0;
    },

    async deleteFleetMetadataExcept(ownerId: string, slugs: string[]): Promise<number> {
      const uniqueSlugs = [...new Set(slugs.map((slug) => slug.trim()).filter(Boolean))];
      if (uniqueSlugs.length === 0) {
        const result = await d1.prepare(
          `DELETE FROM fleet_metadata WHERE owner_id = ?`
        ).bind(ownerId).run();
        return result.meta.changes ?? 0;
      }

      const placeholders = uniqueSlugs.map(() => '?').join(', ');
      const result = await d1.prepare(
        `DELETE FROM fleet_metadata WHERE owner_id = ? AND slug NOT IN (${placeholders})`
      ).bind(ownerId, ...uniqueSlugs).run();
      return result.meta.changes ?? 0;
    },

    // --- Tasks ---
    async createTask(ownerId: string, input: { title: string; description?: string; project_slug?: string; priority?: string; task_type?: string; size?: string; dependencies?: string[]; branch_name?: string | null; pr_url?: string | null; pr_status?: string; commit_sha?: string | null; deployment_url?: string | null; deployment_status?: string; blocked_on_user?: boolean }): Promise<TaskRow> {
      const id = crypto.randomUUID();
      const priority = input.priority ?? 'medium';
      const taskType = input.task_type ?? 'feature';
      const size = input.size ?? 'm';
      const dependencies = sanitizeDependencyIds(input.dependencies);
      await d1.prepare(
        `INSERT INTO tasks (
          id, owner_id, project_slug, title, description, priority, task_type, size, dependencies,
          branch_name, pr_url, pr_status, commit_sha, deployment_url, deployment_status, blocked_on_user
        )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id,
        ownerId,
        input.project_slug ?? null,
        input.title,
        input.description ?? null,
        priority,
        taskType,
        size,
        JSON.stringify(dependencies),
        input.branch_name ?? null,
        input.pr_url ?? null,
        input.pr_status ?? 'none',
        input.commit_sha ?? null,
        input.deployment_url ?? null,
        input.deployment_status ?? 'none',
        input.blocked_on_user ? 1 : 0,
      ).run();
      const row = await d1.prepare(`SELECT t.*, CASE WHEN EXISTS(SELECT 1 FROM changelog_entries ce WHERE ce.task_id = t.id LIMIT 1) THEN 1 ELSE 0 END AS has_changelog FROM tasks t WHERE t.id = ?`).bind(id).first();
      return hydrateTaskRow(row as Record<string, unknown> | null) as TaskRow;
    },

    async listTasks(ownerId: string, status?: string, projectSlug?: string): Promise<TaskRow[]> {
      const conditions = ['t.owner_id = ?'];
      const values: unknown[] = [ownerId];
      if (status) {
        conditions.push('t.status = ?');
        values.push(status);
      }
      if (projectSlug) {
        conditions.push('t.project_slug = ?');
        values.push(projectSlug);
      }

      const { results } = await d1.prepare(
        `SELECT t.*, CASE WHEN EXISTS(SELECT 1 FROM changelog_entries ce WHERE ce.task_id = t.id LIMIT 1) THEN 1 ELSE 0 END AS has_changelog FROM tasks t WHERE ${conditions.join(' AND ')} ORDER BY t.created_at DESC`
      ).bind(...values).all();
      return (results ?? []).map((row) => hydrateTaskRow(row as Record<string, unknown>) as TaskRow);
    },

    async getTask(id: string, ownerId: string): Promise<TaskRow | null> {
      const row = await d1.prepare(
        `SELECT t.*, CASE WHEN EXISTS(SELECT 1 FROM changelog_entries ce WHERE ce.task_id = t.id LIMIT 1) THEN 1 ELSE 0 END AS has_changelog FROM tasks t WHERE t.id = ? AND t.owner_id = ?`
      ).bind(id, ownerId).first();
      return hydrateTaskRow(row as Record<string, unknown> | null);
    },

    async updateTask(id: string, ownerId: string, input: Partial<{ title: string; description: string; status: string; priority: string; project_slug: string; task_type: string; size: string; dependencies: string[]; branch_name: string | null; pr_url: string | null; pr_status: string; commit_sha: string | null; deployment_url: string | null; deployment_status: string; blocked_on_user: boolean }>): Promise<TaskRow | null> {
      const sets: string[] = [];
      const values: unknown[] = [];
      if (input.title !== undefined) { sets.push('title = ?'); values.push(input.title); }
      if (input.description !== undefined) { sets.push('description = ?'); values.push(input.description); }
      if (input.status !== undefined) { sets.push('status = ?'); values.push(input.status); }
      if (input.priority !== undefined) { sets.push('priority = ?'); values.push(input.priority); }
      if (input.project_slug !== undefined) { sets.push('project_slug = ?'); values.push(input.project_slug); }
      if (input.task_type !== undefined) { sets.push('task_type = ?'); values.push(input.task_type); }
      if (input.size !== undefined) { sets.push('size = ?'); values.push(input.size); }
      if (input.branch_name !== undefined) { sets.push('branch_name = ?'); values.push(input.branch_name); }
      if (input.pr_url !== undefined) { sets.push('pr_url = ?'); values.push(input.pr_url); }
      if (input.pr_status !== undefined) { sets.push('pr_status = ?'); values.push(input.pr_status); }
      if (input.commit_sha !== undefined) { sets.push('commit_sha = ?'); values.push(input.commit_sha); }
      if (input.deployment_url !== undefined) { sets.push('deployment_url = ?'); values.push(input.deployment_url); }
      if (input.deployment_status !== undefined) { sets.push('deployment_status = ?'); values.push(input.deployment_status); }
      if (input.blocked_on_user !== undefined) { sets.push('blocked_on_user = ?'); values.push(input.blocked_on_user ? 1 : 0); }
      if (input.dependencies !== undefined) {
        sets.push('dependencies = ?');
        values.push(JSON.stringify(sanitizeDependencyIds(input.dependencies)));
      }
      if (sets.length === 0) return null;
      sets.push("updated_at = datetime('now')");
      const sql = `UPDATE tasks SET ${sets.join(', ')} WHERE id = ? AND owner_id = ?`;
      values.push(id, ownerId);
      await d1.prepare(sql).bind(...values).run();
      const row = await d1.prepare(`SELECT t.*, CASE WHEN EXISTS(SELECT 1 FROM changelog_entries ce WHERE ce.task_id = t.id LIMIT 1) THEN 1 ELSE 0 END AS has_changelog FROM tasks t WHERE t.id = ?`).bind(id).first();
      return hydrateTaskRow(row as Record<string, unknown> | null);
    },

    async deleteTask(id: string, ownerId: string): Promise<boolean> {
      const { meta } = await d1.prepare(
        `DELETE FROM tasks WHERE id = ? AND owner_id = ?`
      ).bind(id, ownerId).run();
      return (meta.changes ?? 0) > 0;
    },

    async listTaskComments(ownerId: string, taskId: string): Promise<TaskCommentRow[]> {
      const { results } = await d1.prepare(
        `SELECT * FROM task_comments WHERE owner_id = ? AND task_id = ? ORDER BY created_at ASC`
      ).bind(ownerId, taskId).all();
      return (results ?? []).map((row) => hydrateTaskCommentRow(row as Record<string, unknown>) as TaskCommentRow);
    },

    async createTaskComment(ownerId: string, taskId: string, input: { body: string; author_type?: string; resolves_blocker?: boolean; marks_done?: boolean; sync_to_description?: boolean }): Promise<TaskCommentRow | null> {
      const task = await d1.prepare(
        `SELECT id FROM tasks WHERE id = ? AND owner_id = ?`
      ).bind(taskId, ownerId).first();
      if (!task) return null;

      const id = crypto.randomUUID();
      const authorType = input.author_type === 'agent' ? 'agent' : 'user';
      const resolvesBlocker = input.resolves_blocker ? 1 : 0;
      const marksDone = input.marks_done ? 1 : 0;
      await d1.prepare(
        `INSERT INTO task_comments (id, owner_id, task_id, author_type, body, resolves_blocker, marks_done)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(id, ownerId, taskId, authorType, input.body, resolvesBlocker, marksDone).run();
      if (resolvesBlocker) {
        await d1.prepare(
          `UPDATE tasks SET blocked_on_user = 0, updated_at = datetime('now') WHERE id = ? AND owner_id = ?`
        ).bind(taskId, ownerId).run();
      }
      if (marksDone) {
        await d1.prepare(
          `UPDATE tasks SET status = 'done', blocked_on_user = 0, updated_at = datetime('now') WHERE id = ? AND owner_id = ?`
        ).bind(taskId, ownerId).run();
      }
      if (input.sync_to_description) {
        const descriptionNote = `Decision / Handoff\n${input.body}`;
        await d1.prepare(
          `UPDATE tasks
           SET description = CASE
             WHEN description IS NULL OR trim(description) = '' THEN ?
             ELSE description || char(10) || char(10) || ?
           END,
           updated_at = datetime('now')
           WHERE id = ? AND owner_id = ?`
        ).bind(descriptionNote, descriptionNote, taskId, ownerId).run();
      }
      const row = await d1.prepare(`SELECT * FROM task_comments WHERE id = ?`).bind(id).first();
      return hydrateTaskCommentRow(row as Record<string, unknown> | null);
    },

    async createSymphonyAuditEvent(ownerId: string, input: {
      task_id?: string | null;
      action: string;
      actor_source?: string;
      agent_profile?: string | null;
      project_slug?: string | null;
      metadata?: Record<string, unknown>;
    }): Promise<SymphonyAuditLogRow> {
      const id = crypto.randomUUID();
      const metadata = JSON.stringify(input.metadata ?? {});
      await d1.prepare(
        `INSERT INTO symphony_audit_log (id, owner_id, task_id, action, actor_source, agent_profile, project_slug, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id,
        ownerId,
        input.task_id ?? null,
        input.action,
        input.actor_source ?? 'api',
        input.agent_profile ?? null,
        input.project_slug ?? null,
        metadata,
      ).run();
      const row = await d1.prepare(
        `SELECT * FROM symphony_audit_log WHERE id = ?`
      ).bind(id).first();
      return row as unknown as SymphonyAuditLogRow;
    },

    async listSymphonyAuditEvents(ownerId: string, input: { task_id?: string; limit?: number } = {}): Promise<SymphonyAuditLogRow[]> {
      const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
      const conditions = ['owner_id = ?'];
      const values: unknown[] = [ownerId];
      if (input.task_id) {
        conditions.push('task_id = ?');
        values.push(input.task_id);
      }
      values.push(limit);
      const { results } = await d1.prepare(
        `SELECT * FROM symphony_audit_log WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT ?`
      ).bind(...values).all();
      return results as unknown as SymphonyAuditLogRow[];
    },

    async createSymphonyRun(ownerId: string, input: {
      task_id?: string | null;
      project_slug?: string | null;
      agent_profile?: string | null;
      model_profile?: string | null;
      command_template: string;
      pid?: number | null;
      status?: string;
      workspace_path?: string | null;
      prompt_path?: string | null;
      terminal_hint?: string | null;
      log_hint?: string | null;
      cost_note?: string | null;
      token_note?: string | null;
      metadata?: Record<string, unknown>;
      started_at?: string | null;
    }): Promise<SymphonyRunRow> {
      const id = crypto.randomUUID();
      const metadata = JSON.stringify(input.metadata ?? {});
      await d1.prepare(
        `INSERT INTO symphony_runs (
          id, owner_id, task_id, project_slug, agent_profile, model_profile,
          command_template, pid, status, workspace_path, prompt_path,
          terminal_hint, log_hint, cost_note, token_note, metadata, started_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))`
      ).bind(
        id,
        ownerId,
        input.task_id ?? null,
        input.project_slug ?? null,
        input.agent_profile ?? null,
        input.model_profile ?? null,
        input.command_template,
        input.pid ?? null,
        input.status ?? 'started',
        input.workspace_path ?? null,
        input.prompt_path ?? null,
        input.terminal_hint ?? null,
        input.log_hint ?? null,
        input.cost_note ?? null,
        input.token_note ?? null,
        metadata,
        input.started_at ?? null,
      ).run();
      const row = await d1.prepare(
        `SELECT * FROM symphony_runs WHERE id = ?`
      ).bind(id).first();
      return row as unknown as SymphonyRunRow;
    },

    async listSymphonyRuns(ownerId: string, input: { task_id?: string; limit?: number } = {}): Promise<SymphonyRunRow[]> {
      const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
      const conditions = ['owner_id = ?'];
      const values: unknown[] = [ownerId];
      if (input.task_id) {
        conditions.push('task_id = ?');
        values.push(input.task_id);
      }
      values.push(limit);
      const { results } = await d1.prepare(
        `SELECT * FROM symphony_runs WHERE ${conditions.join(' AND ')} ORDER BY started_at DESC, created_at DESC LIMIT ?`
      ).bind(...values).all();
      return results as unknown as SymphonyRunRow[];
    },

    // --- Symphony Memory ---
    async getSymphonyMemory(ownerId: string): Promise<SymphonyMemoryRow | null> {
      const row = await d1.prepare(
        `SELECT owner_id, content, updated_at FROM symphony_memory WHERE owner_id = ?`
      ).bind(ownerId).first();
      return mapRow<SymphonyMemoryRow>(row);
    },

    async upsertSymphonyMemory(ownerId: string, content: string): Promise<SymphonyMemoryRow> {
      await d1.prepare(
        `INSERT INTO symphony_memory (owner_id, content, updated_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(owner_id) DO UPDATE SET
           content = EXCLUDED.content,
           updated_at = datetime('now')`
      ).bind(ownerId, content).run();
      const row = await d1.prepare(
        `SELECT owner_id, content, updated_at FROM symphony_memory WHERE owner_id = ?`
      ).bind(ownerId).first();
      return mapRow<SymphonyMemoryRow>(row)!;
    },
  };
}
