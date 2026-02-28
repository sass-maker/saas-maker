import postgres from 'postgres';
import type { FeedbackDatabase } from '@saasmaker/db';
import type {
  FeedbackRecord,
  ProjectRecord,
  UserRecord,
  UpvoteRecord,
  IndexRecord,
  DocumentRecord,
  WaitlistEntryRecord,
  EventRecord,
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
      const sets = [];
      if (input.name !== undefined) sets.push(sql`name = ${input.name}`);
      if (input.embedding_model !== undefined) sets.push(sql`embedding_model = ${input.embedding_model}`);

      if (sets.length > 0) {
        const setClause = sets.reduce((acc, s, i) => i === 0 ? s : sql`${acc}, ${s}`);
        const [row] = await sql`UPDATE projects SET ${setClause} WHERE id = ${id} RETURNING *`;
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

    // --- Vector Memory: Indexes ---
    async createIndex(input) {
      const [row] = await sql`
        INSERT INTO indexes (id, project_id, name, external_id)
        VALUES (${input.id}, ${input.project_id}, ${input.name}, ${input.external_id})
        RETURNING *
      `;
      return row as IndexRecord;
    },

    async getIndexById(id) {
      const [row] = await sql`SELECT * FROM indexes WHERE id = ${id}`;
      return (row as IndexRecord) || null;
    },

    async listIndexesByProject(projectId) {
      const rows = await sql`
        SELECT i.*, COALESCE(d.cnt, 0)::int AS document_count
        FROM indexes i
        LEFT JOIN (SELECT index_id, COUNT(*) AS cnt FROM documents GROUP BY index_id) d
          ON d.index_id = i.id
        WHERE i.project_id = ${projectId}
        ORDER BY i.created_at DESC
      `;
      return rows as unknown as (IndexRecord & { document_count: number })[];
    },

    async deleteIndex(id) {
      const result = await sql`DELETE FROM indexes WHERE id = ${id}`;
      return result.count > 0;
    },

    // --- Vector Memory: Documents ---
    async createDocument(input) {
      const [row] = await sql`
        INSERT INTO documents (id, index_id, content, metadata)
        VALUES (${input.id}, ${input.index_id}, ${input.content}, ${JSON.stringify(input.metadata)})
        RETURNING *
      `;
      return row as DocumentRecord;
    },

    async getDocumentById(id) {
      const [row] = await sql`SELECT * FROM documents WHERE id = ${id}`;
      return (row as DocumentRecord) || null;
    },

    async listDocumentsByIndex(indexId, page, limit) {
      const offset = (page - 1) * limit;
      const [countResult] = await sql`SELECT COUNT(*)::int AS total FROM documents WHERE index_id = ${indexId}`;
      const rows = await sql`
        SELECT * FROM documents WHERE index_id = ${indexId}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      return { data: rows as unknown as DocumentRecord[], total: countResult.total };
    },

    async deleteDocument(id) {
      const result = await sql`DELETE FROM documents WHERE id = ${id}`;
      return result.count > 0;
    },

    // --- Vector Memory: Chunks ---
    async createChunks(chunks) {
      if (chunks.length === 0) return 0;
      const values = chunks.map(c => ({
        id: c.id,
        document_id: c.document_id,
        index_id: c.index_id,
        content: c.content,
        embedding: `[${c.embedding.join(',')}]`,
        chunk_index: c.chunk_index,
      }));
      await sql`
        INSERT INTO chunks ${sql(values, 'id', 'document_id', 'index_id', 'content', 'embedding', 'chunk_index')}
      `;
      return chunks.length;
    },

    async searchChunks(indexId, queryEmbedding, topK) {
      const embeddingStr = `[${queryEmbedding.join(',')}]`;
      const rows = await sql`
        SELECT c.document_id, c.content, d.metadata,
               (c.embedding <=> ${embeddingStr}::vector) AS distance
        FROM chunks c
        JOIN documents d ON d.id = c.document_id
        WHERE c.index_id = ${indexId}
        ORDER BY c.embedding <=> ${embeddingStr}::vector
        LIMIT ${topK}
      `;
      return (rows as unknown as { document_id: string; content: string; metadata: Record<string, unknown>; distance: number }[])
        .map(r => ({
          document_id: r.document_id,
          content: r.content,
          score: 1 - Number(r.distance),
          metadata: r.metadata,
        }));
    },

    async deleteChunksByDocument(documentId) {
      const result = await sql`DELETE FROM chunks WHERE document_id = ${documentId}`;
      return result.count > 0;
    },

    // --- Waitlist ---
    async createWaitlistEntry(input) {
      const [posRow] = await sql`
        SELECT COALESCE(MAX(position), 0) + 1 AS next_pos
        FROM waitlist_entries WHERE project_id = ${input.project_id}
      `;
      const [row] = await sql`
        INSERT INTO waitlist_entries (id, project_id, email, name, position)
        VALUES (${input.id}, ${input.project_id}, ${input.email}, ${input.name}, ${posRow.next_pos})
        RETURNING *
      `;
      return row as WaitlistEntryRecord;
    },

    async getWaitlistCount(projectId) {
      const [row] = await sql`
        SELECT COUNT(*)::int AS total FROM waitlist_entries WHERE project_id = ${projectId}
      `;
      return row.total;
    },

    async listWaitlistEntries(projectId, page, limit) {
      const offset = (page - 1) * limit;
      const [countResult] = await sql`
        SELECT COUNT(*)::int AS total FROM waitlist_entries WHERE project_id = ${projectId}
      `;
      const rows = await sql`
        SELECT * FROM waitlist_entries WHERE project_id = ${projectId}
        ORDER BY position ASC
        LIMIT ${limit} OFFSET ${offset}
      `;
      return { data: rows as unknown as WaitlistEntryRecord[], total: countResult.total };
    },

    async deleteWaitlistEntry(id) {
      const result = await sql`DELETE FROM waitlist_entries WHERE id = ${id}`;
      return result.count > 0;
    },

    // --- Analytics ---
    async createEvent(input) {
      const [row] = await sql`
        INSERT INTO events (id, project_id, name, url, referrer, utm_source, utm_medium, utm_campaign, country, device, browser, screen_width, properties)
        VALUES (${input.id}, ${input.project_id}, ${input.name}, ${input.url}, ${input.referrer}, ${input.utm_source}, ${input.utm_medium}, ${input.utm_campaign}, ${input.country}, ${input.device}, ${input.browser}, ${input.screen_width}, ${JSON.stringify(input.properties)})
        RETURNING *
      `;
      return row as EventRecord;
    },

    async getAnalyticsOverview(projectId, since) {
      const [row] = await sql`
        SELECT
          COUNT(*)::int AS page_views,
          COUNT(DISTINCT (created_at::date || '|' || COALESCE(country,'') || '|' || COALESCE(device,'') || '|' || COALESCE(browser,'')))::int AS unique_visitors
        FROM events
        WHERE project_id = ${projectId} AND name = 'page_view' AND created_at >= ${since}
      `;
      const [topPage] = await sql`
        SELECT url, COUNT(*)::int AS cnt FROM events
        WHERE project_id = ${projectId} AND name = 'page_view' AND created_at >= ${since} AND url IS NOT NULL
        GROUP BY url ORDER BY cnt DESC LIMIT 1
      `;
      const [topRef] = await sql`
        SELECT referrer, COUNT(*)::int AS cnt FROM events
        WHERE project_id = ${projectId} AND name = 'page_view' AND created_at >= ${since} AND referrer IS NOT NULL AND referrer != ''
        GROUP BY referrer ORDER BY cnt DESC LIMIT 1
      `;
      return {
        page_views: row.page_views,
        unique_visitors: row.unique_visitors,
        top_page: topPage?.url || null,
        top_referrer: topRef?.referrer || null,
      };
    },

    async getTopPages(projectId, since, limit) {
      const rows = await sql`
        SELECT url, COUNT(*)::int AS views FROM events
        WHERE project_id = ${projectId} AND name = 'page_view' AND created_at >= ${since} AND url IS NOT NULL
        GROUP BY url ORDER BY views DESC LIMIT ${limit}
      `;
      return rows as unknown as { url: string; views: number }[];
    },

    async getTopReferrers(projectId, since, limit) {
      const rows = await sql`
        SELECT referrer, COUNT(*)::int AS count FROM events
        WHERE project_id = ${projectId} AND name = 'page_view' AND created_at >= ${since} AND referrer IS NOT NULL AND referrer != ''
        GROUP BY referrer ORDER BY count DESC LIMIT ${limit}
      `;
      return rows as unknown as { referrer: string; count: number }[];
    },

    async getCountryBreakdown(projectId, since, limit) {
      const rows = await sql`
        SELECT country, COUNT(*)::int AS count FROM events
        WHERE project_id = ${projectId} AND created_at >= ${since} AND country IS NOT NULL
        GROUP BY country ORDER BY count DESC LIMIT ${limit}
      `;
      return rows as unknown as { country: string; count: number }[];
    },

    async getDeviceBreakdown(projectId, since) {
      const rows = await sql`
        SELECT device, COUNT(*)::int AS count FROM events
        WHERE project_id = ${projectId} AND created_at >= ${since} AND device IS NOT NULL
        GROUP BY device ORDER BY count DESC
      `;
      return rows as unknown as { device: string; count: number }[];
    },

    async getCustomEventCounts(projectId, since, limit) {
      const rows = await sql`
        SELECT name, COUNT(*)::int AS count FROM events
        WHERE project_id = ${projectId} AND created_at >= ${since} AND name != 'page_view'
        GROUP BY name ORDER BY count DESC LIMIT ${limit}
      `;
      return rows as unknown as { name: string; count: number }[];
    },
  };
}

let _db: FeedbackDatabase | null = null;

export function getDb(databaseUrl: string): FeedbackDatabase {
  if (!_db) _db = createDatabase(databaseUrl);
  return _db;
}
