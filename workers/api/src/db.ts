import type {
  AnyFeedbackStatus,
  FeedbackRecord,
  FeedbackType,
  FeedbackVote,
  ProjectRecord,
  UpvoteRecord,
  UserRecord,
} from '@saas-maker/contracts';

type FeedbackQuery = {
  type?: FeedbackType;
  status?: AnyFeedbackStatus;
  sort?: 'newest' | 'upvotes';
  page?: number;
  limit?: number;
};

type ProjectInput = {
  id: string;
  name: string;
  slug: string;
  api_key: string;
  owner_id: string;
  source?: string;
  git_url?: string | null;
};

type FeedbackInput = Omit<
  FeedbackRecord,
  'upvote_count' | 'downvote_count' | 'viewer_vote' | 'created_at'
>;

export interface FeedbackDatabase {
  upsertUser(input: Omit<UserRecord, 'created_at'>): Promise<UserRecord>;
  getUserById(id: string): Promise<UserRecord | null>;
  createProject(input: ProjectInput): Promise<ProjectRecord>;
  getProjectBySlug(slug: string): Promise<ProjectRecord | null>;
  getProjectByApiKey(apiKey: string): Promise<ProjectRecord | null>;
  getProjectById(id: string): Promise<ProjectRecord | null>;
  listProjectsByOwner(ownerId: string, source?: string): Promise<ProjectRecord[]>;
  updateProject(
    id: string,
    input: { name?: string; readme?: string; git_url?: string | null }
  ): Promise<ProjectRecord | null>;
  deleteProject(id: string): Promise<boolean>;
  createFeedback(input: FeedbackInput): Promise<FeedbackRecord>;
  getFeedbackById(id: string): Promise<FeedbackRecord | null>;
  listFeedback(
    projectId: string,
    query: FeedbackQuery,
    userId?: string
  ): Promise<{ data: FeedbackRecord[]; total: number }>;
  updateFeedbackStatus(id: string, status: AnyFeedbackStatus): Promise<FeedbackRecord | null>;
  deleteFeedback(id: string): Promise<boolean>;
  setVote(input: {
    id: string;
    feedback_id: string;
    user_id: string;
    vote: 1 | -1;
  }): Promise<UpvoteRecord>;
  removeVote(feedbackId: string, userId: string): Promise<boolean>;
  getUserVote(feedbackId: string, userId: string): Promise<FeedbackVote>;
}

function mapRow<T>(row: Record<string, unknown> | null | undefined): T | null {
  return row ? (row as T) : null;
}

function parseViewerVote(value: unknown): FeedbackVote {
  if (Number(value) === 1) return 'up';
  if (Number(value) === -1) return 'down';
  return null;
}

function toFeedbackRecord(row: Record<string, unknown>): FeedbackRecord {
  return {
    ...(row as unknown as FeedbackRecord),
    viewer_vote: parseViewerVote(row.viewer_vote),
  };
}

export function getDb(d1: D1Database): FeedbackDatabase {
  return {
    async upsertUser(input) {
      await d1
        .prepare(
          `INSERT INTO users (id, email, name, avatar_url)
           VALUES (?, ?, ?, ?)
           ON CONFLICT (email) DO UPDATE SET
             name = EXCLUDED.name,
             avatar_url = EXCLUDED.avatar_url`
        )
        .bind(input.id, input.email, input.name, input.avatar_url)
        .run();
      const row =
        (await d1.prepare('SELECT * FROM users WHERE id = ?').bind(input.id).first()) ??
        (await d1.prepare('SELECT * FROM users WHERE email = ?').bind(input.email).first());
      return mapRow<UserRecord>(row)!;
    },

    async getUserById(id) {
      return mapRow<UserRecord>(
        await d1.prepare('SELECT * FROM users WHERE id = ?').bind(id).first()
      );
    },

    async createProject(input) {
      await d1
        .prepare(
          `INSERT INTO projects (id, name, slug, api_key, owner_id, source, git_url)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          input.id,
          input.name,
          input.slug,
          input.api_key,
          input.owner_id,
          input.source || 'dashboard',
          input.git_url ?? null
        )
        .run();
      return mapRow<ProjectRecord>(
        await d1.prepare('SELECT * FROM projects WHERE id = ?').bind(input.id).first()
      )!;
    },

    async getProjectBySlug(slug) {
      return mapRow<ProjectRecord>(
        await d1.prepare('SELECT * FROM projects WHERE slug = ?').bind(slug).first()
      );
    },

    async getProjectByApiKey(apiKey) {
      return mapRow<ProjectRecord>(
        await d1.prepare('SELECT * FROM projects WHERE api_key = ?').bind(apiKey).first()
      );
    },

    async getProjectById(id) {
      return mapRow<ProjectRecord>(
        await d1.prepare('SELECT * FROM projects WHERE id = ?').bind(id).first()
      );
    },

    async listProjectsByOwner(ownerId, source = 'dashboard') {
      const statement =
        source === 'all'
          ? d1
              .prepare('SELECT * FROM projects WHERE owner_id = ? ORDER BY created_at DESC')
              .bind(ownerId)
          : d1
              .prepare(
                'SELECT * FROM projects WHERE owner_id = ? AND source = ? ORDER BY created_at DESC'
              )
              .bind(ownerId, source);
      const { results } = await statement.all();
      return results as unknown as ProjectRecord[];
    },

    async updateProject(id, input) {
      const assignments: string[] = [];
      const values: unknown[] = [];
      if (input.name !== undefined) {
        assignments.push('name = ?');
        values.push(input.name);
      }
      if (input.readme !== undefined) {
        assignments.push('readme = ?');
        values.push(input.readme);
      }
      if (input.git_url !== undefined) {
        assignments.push('git_url = ?');
        values.push(input.git_url);
      }
      if (assignments.length > 0) {
        values.push(id);
        await d1
          .prepare(`UPDATE projects SET ${assignments.join(', ')} WHERE id = ?`)
          .bind(...values)
          .run();
      }
      return mapRow<ProjectRecord>(
        await d1.prepare('SELECT * FROM projects WHERE id = ?').bind(id).first()
      );
    },

    async deleteProject(id) {
      const { meta } = await d1.prepare('DELETE FROM projects WHERE id = ?').bind(id).run();
      return (meta.changes ?? 0) > 0;
    },

    async createFeedback(input) {
      await d1
        .prepare(
          `INSERT INTO feedback
             (id, project_id, type, status, title, description, image_url, submitter_email, submitter_name)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          input.id,
          input.project_id,
          input.type,
          input.status,
          input.title,
          input.description,
          input.image_url,
          input.submitter_email,
          input.submitter_name
        )
        .run();
      const row = await d1
        .prepare('SELECT *, NULL AS viewer_vote FROM feedback WHERE id = ?')
        .bind(input.id)
        .first();
      return toFeedbackRecord(row as Record<string, unknown>);
    },

    async getFeedbackById(id) {
      const row = await d1
        .prepare('SELECT *, NULL AS viewer_vote FROM feedback WHERE id = ?')
        .bind(id)
        .first();
      return row ? toFeedbackRecord(row as Record<string, unknown>) : null;
    },

    async listFeedback(projectId, query, userId) {
      const { type, status, sort = 'newest', page = 1, limit = 20 } = query;
      const offset = (page - 1) * limit;
      const conditions = ['f.project_id = ?'];
      const values: unknown[] = [projectId];
      if (type) {
        conditions.push('f.type = ?');
        values.push(type);
      }
      if (status) {
        conditions.push('f.status = ?');
        values.push(status);
      }
      const where = conditions.join(' AND ');
      const orderBy =
        sort === 'upvotes' ? 'f.upvote_count DESC, f.created_at DESC' : 'f.created_at DESC';
      const countStatement = d1
        .prepare(`SELECT COUNT(*) AS total FROM feedback f WHERE ${where}`)
        .bind(...values);
      const dataStatement = userId
        ? d1
            .prepare(
              `SELECT f.*, v.vote AS viewer_vote
               FROM feedback f
               LEFT JOIN feedback_votes v
                 ON v.feedback_id = f.id AND v.user_id = ?
               WHERE ${where}
               ORDER BY ${orderBy}
               LIMIT ? OFFSET ?`
            )
            .bind(userId, ...values, limit, offset)
        : d1
            .prepare(
              `SELECT f.*, NULL AS viewer_vote
               FROM feedback f
               WHERE ${where}
               ORDER BY ${orderBy}
               LIMIT ? OFFSET ?`
            )
            .bind(...values, limit, offset);
      const [countRow, dataResult] = await Promise.all([
        countStatement.first<{ total: number }>(),
        dataStatement.all(),
      ]);
      return {
        data: (dataResult.results as Record<string, unknown>[]).map(toFeedbackRecord),
        total: Number(countRow?.total ?? 0),
      };
    },

    async updateFeedbackStatus(id, status) {
      await d1.prepare('UPDATE feedback SET status = ? WHERE id = ?').bind(status, id).run();
      const row = await d1
        .prepare('SELECT *, NULL AS viewer_vote FROM feedback WHERE id = ?')
        .bind(id)
        .first();
      return row ? toFeedbackRecord(row as Record<string, unknown>) : null;
    },

    async deleteFeedback(id) {
      const { meta } = await d1.prepare('DELETE FROM feedback WHERE id = ?').bind(id).run();
      return (meta.changes ?? 0) > 0;
    },

    async setVote(input) {
      const existing = await d1
        .prepare('SELECT * FROM feedback_votes WHERE feedback_id = ? AND user_id = ?')
        .bind(input.feedback_id, input.user_id)
        .first<Record<string, unknown>>();

      if (!existing) {
        await d1
          .prepare(
            'INSERT INTO feedback_votes (id, feedback_id, user_id, vote) VALUES (?, ?, ?, ?)'
          )
          .bind(input.id, input.feedback_id, input.user_id, input.vote)
          .run();
        const counter = input.vote === 1 ? 'upvote_count' : 'downvote_count';
        await d1
          .prepare(`UPDATE feedback SET ${counter} = ${counter} + 1 WHERE id = ?`)
          .bind(input.feedback_id)
          .run();
        return (await d1
          .prepare('SELECT * FROM feedback_votes WHERE id = ?')
          .bind(input.id)
          .first()) as unknown as UpvoteRecord;
      }

      const existingVote = Number(existing.vote) as 1 | -1;
      if (existingVote === input.vote) return existing as unknown as UpvoteRecord;

      await d1
        .prepare('UPDATE feedback_votes SET vote = ? WHERE id = ?')
        .bind(input.vote, existing.id)
        .run();
      const decrement = existingVote === 1 ? 'upvote_count' : 'downvote_count';
      const increment = input.vote === 1 ? 'upvote_count' : 'downvote_count';
      await d1
        .prepare(
          `UPDATE feedback
           SET ${decrement} = MAX(${decrement} - 1, 0),
               ${increment} = ${increment} + 1
           WHERE id = ?`
        )
        .bind(input.feedback_id)
        .run();
      return (await d1
        .prepare('SELECT * FROM feedback_votes WHERE id = ?')
        .bind(existing.id)
        .first()) as unknown as UpvoteRecord;
    },

    async removeVote(feedbackId, userId) {
      const existing = await d1
        .prepare('SELECT * FROM feedback_votes WHERE feedback_id = ? AND user_id = ?')
        .bind(feedbackId, userId)
        .first<Record<string, unknown>>();
      if (!existing) return false;

      await d1.prepare('DELETE FROM feedback_votes WHERE id = ?').bind(existing.id).run();
      const counter = Number(existing.vote) === 1 ? 'upvote_count' : 'downvote_count';
      await d1
        .prepare(`UPDATE feedback SET ${counter} = MAX(${counter} - 1, 0) WHERE id = ?`)
        .bind(feedbackId)
        .run();
      return true;
    },

    async getUserVote(feedbackId, userId) {
      const row = await d1
        .prepare('SELECT vote FROM feedback_votes WHERE feedback_id = ? AND user_id = ?')
        .bind(feedbackId, userId)
        .first();
      return parseViewerVote(row?.vote);
    },
  };
}

export const createDatabase = getDb;
