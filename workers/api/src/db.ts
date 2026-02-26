import postgres from 'postgres';
import type { FeedbackDatabase } from '@saasmaker/db';
import type {
  FeedbackRecord,
  ProjectRecord,
  UserRecord,
  UpvoteRecord,
} from '@saasmaker/shared-types';

export function createDatabase(databaseUrl: string): FeedbackDatabase {
  const sql = postgres(databaseUrl, { ssl: 'require' });

  return {
    // --- Users ---
    async upsertUser(input) {
      const [row] = await sql`
        INSERT INTO users (id, email, name, avatar_url)
        VALUES (${input.id}, ${input.email}, ${input.name}, ${input.avatar_url})
        ON CONFLICT (email) DO UPDATE SET
          name = EXCLUDED.name,
          avatar_url = EXCLUDED.avatar_url
        RETURNING *
      `;
      return row as UserRecord;
    },

    async getUserById(id) {
      const [row] = await sql`SELECT * FROM users WHERE id = ${id}`;
      return (row as UserRecord) || null;
    },

    // --- Sessions ---
    async createSession(input) {
      await sql`
        INSERT INTO sessions (token_hash, user_id, expires_at)
        VALUES (${input.token_hash}, ${input.user_id}, ${input.expires_at})
      `;
    },

    async getSessionByTokenHash(tokenHash) {
      const [row] = await sql`
        SELECT user_id, expires_at FROM sessions
        WHERE token_hash = ${tokenHash} AND expires_at > NOW()
      `;
      return row ? { user_id: row.user_id as string, expires_at: row.expires_at as string } : null;
    },

    async deleteSession(tokenHash) {
      await sql`DELETE FROM sessions WHERE token_hash = ${tokenHash}`;
    },

    // --- Projects ---
    async createProject(input) {
      const [row] = await sql`
        INSERT INTO projects (id, name, slug, api_key, owner_id)
        VALUES (${input.id}, ${input.name}, ${input.slug}, ${input.api_key}, ${input.owner_id})
        RETURNING *
      `;
      return row as ProjectRecord;
    },

    async getProjectBySlug(slug) {
      const [row] = await sql`SELECT * FROM projects WHERE slug = ${slug}`;
      return (row as ProjectRecord) || null;
    },

    async getProjectByApiKey(apiKey) {
      const [row] = await sql`SELECT * FROM projects WHERE api_key = ${apiKey}`;
      return (row as ProjectRecord) || null;
    },

    async getProjectById(id) {
      const [row] = await sql`SELECT * FROM projects WHERE id = ${id}`;
      return (row as ProjectRecord) || null;
    },

    async listProjectsByOwner(ownerId) {
      const rows = await sql`SELECT * FROM projects WHERE owner_id = ${ownerId} ORDER BY created_at DESC`;
      return rows as unknown as ProjectRecord[];
    },

    async updateProject(id, input) {
      if (input.name !== undefined) {
        const [row] = await sql`UPDATE projects SET name = ${input.name} WHERE id = ${id} RETURNING *`;
        return (row as ProjectRecord) || null;
      }
      const [row] = await sql`SELECT * FROM projects WHERE id = ${id}`;
      return (row as ProjectRecord) || null;
    },

    async deleteProject(id) {
      const result = await sql`DELETE FROM projects WHERE id = ${id}`;
      return result.count > 0;
    },

    // --- Feedback ---
    async createFeedback(input) {
      const [row] = await sql`
        INSERT INTO feedback (id, project_id, type, title, description, image_url, submitter_email, submitter_name)
        VALUES (${input.id}, ${input.project_id}, ${input.type}, ${input.title}, ${input.description}, ${input.image_url}, ${input.submitter_email}, ${input.submitter_name})
        RETURNING *
      `;
      return row as FeedbackRecord;
    },

    async getFeedbackById(id) {
      const [row] = await sql`SELECT * FROM feedback WHERE id = ${id}`;
      return (row as FeedbackRecord) || null;
    },

    async listFeedback(projectId, query) {
      const { type, status, sort = 'newest', page = 1, limit = 20 } = query;
      const offset = (page - 1) * limit;

      // Build WHERE conditions
      const conditions = [sql`project_id = ${projectId}`];
      if (type) conditions.push(sql`type = ${type}`);
      if (status) conditions.push(sql`status = ${status}`);

      const where = conditions.reduce((acc, cond, i) =>
        i === 0 ? cond : sql`${acc} AND ${cond}`
      );

      const orderBy =
        sort === 'upvotes'
          ? sql`upvote_count DESC, created_at DESC`
          : sql`created_at DESC`;

      const [countResult] = await sql`SELECT COUNT(*)::int as total FROM feedback WHERE ${where}`;
      const rows = await sql`SELECT * FROM feedback WHERE ${where} ORDER BY ${orderBy} LIMIT ${limit} OFFSET ${offset}`;

      return { data: rows as unknown as FeedbackRecord[], total: countResult.total };
    },

    async updateFeedbackStatus(id, status) {
      const [row] = await sql`UPDATE feedback SET status = ${status} WHERE id = ${id} RETURNING *`;
      return (row as FeedbackRecord) || null;
    },

    async deleteFeedback(id) {
      const result = await sql`DELETE FROM feedback WHERE id = ${id}`;
      return result.count > 0;
    },

    // --- Upvotes ---
    async addUpvote(input) {
      const [row] = await sql`
        INSERT INTO upvotes (id, feedback_id, user_id)
        VALUES (${input.id}, ${input.feedback_id}, ${input.user_id})
        RETURNING *
      `;
      await sql`UPDATE feedback SET upvote_count = upvote_count + 1 WHERE id = ${input.feedback_id}`;
      return row as UpvoteRecord;
    },

    async removeUpvote(feedbackId, userId) {
      const result = await sql`DELETE FROM upvotes WHERE feedback_id = ${feedbackId} AND user_id = ${userId}`;
      if (result.count > 0) {
        await sql`UPDATE feedback SET upvote_count = GREATEST(upvote_count - 1, 0) WHERE id = ${feedbackId}`;
        return true;
      }
      return false;
    },

    async hasUpvoted(feedbackId, userId) {
      const [row] = await sql`SELECT 1 FROM upvotes WHERE feedback_id = ${feedbackId} AND user_id = ${userId}`;
      return !!row;
    },
  };
}

let _db: FeedbackDatabase | null = null;

export function getDb(databaseUrl: string): FeedbackDatabase {
  if (!_db) _db = createDatabase(databaseUrl);
  return _db;
}
