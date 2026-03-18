import type { FeedbackDatabase } from '@saas-maker/db';
import type {
  FeedbackRecord,
  FeedbackVote,
  ProjectRecord,
  UserRecord,
  UpvoteRecord,
  IndexRecord,
  DocumentRecord,
  WaitlistEntryRecord,
  EventRecord,

  TestimonialRecord,
  ChangelogEntryRecord,
  FormRecord,
  FormQuestionRecord,
  FormResponseRecord,
  FormAnswerRecord,
  RoadmapItemRecord,
} from '@saas-maker/shared-types';

function parseViewerVote(value: unknown): FeedbackVote {
  if (value === 1 || value === '1') return 'up';
  if (value === -1 || value === '-1') return 'down';
  return null;
}

function toFeedbackRecord(row: Record<string, unknown>): FeedbackRecord {
  return {
    ...(row as unknown as FeedbackRecord),
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
      const row = await d1.prepare(`SELECT * FROM users WHERE id = ?`).bind(input.id).first();
      return row as unknown as UserRecord;
    },

    async getUserById(id) {
      const row = await d1.prepare(`SELECT * FROM users WHERE id = ?`).bind(id).first();
      return (row as unknown as UserRecord) || null;
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
      return row as unknown as ProjectRecord;
    },

    async getProjectBySlug(slug) {
      const row = await d1.prepare(`SELECT * FROM projects WHERE slug = ?`).bind(slug).first();
      return (row as unknown as ProjectRecord) || null;
    },

    async getProjectByApiKey(apiKey) {
      const row = await d1.prepare(`SELECT * FROM projects WHERE api_key = ?`).bind(apiKey).first();
      return (row as unknown as ProjectRecord) || null;
    },

    async getProjectById(id) {
      const row = await d1.prepare(`SELECT * FROM projects WHERE id = ?`).bind(id).first();
      return (row as unknown as ProjectRecord) || null;
    },

    async listProjectsByOwner(ownerId, source) {
      if (source === 'all') {
        const { results } = await d1.prepare(
          `SELECT * FROM projects WHERE owner_id = ? ORDER BY created_at DESC`
        ).bind(ownerId).all();
        return results as unknown as ProjectRecord[];
      }
      const filterSource = source || 'dashboard';
      const { results } = await d1.prepare(
        `SELECT * FROM projects WHERE owner_id = ? AND source = ? ORDER BY created_at DESC`
      ).bind(ownerId, filterSource).all();
      return results as unknown as ProjectRecord[];
    },

    async updateProject(id, input) {
      const sets: string[] = [];
      const values: unknown[] = [];
      if (input.name !== undefined) { sets.push('name = ?'); values.push(input.name); }
      if (input.embedding_model !== undefined) { sets.push('embedding_model = ?'); values.push(input.embedding_model); }
      if (input.rate_limit_rpm !== undefined) { sets.push('rate_limit_rpm = ?'); values.push(input.rate_limit_rpm); }
      if (input.rate_limit_enabled !== undefined) { sets.push('rate_limit_enabled = ?'); values.push(input.rate_limit_enabled ? 1 : 0); }
      if (input.readme !== undefined) { sets.push('readme = ?'); values.push(input.readme); }

      if (sets.length > 0) {
        const sql = `UPDATE projects SET ${sets.join(', ')} WHERE id = ?`;
        values.push(id);
        await d1.prepare(sql).bind(...values).run();
      }
      const row = await d1.prepare(`SELECT * FROM projects WHERE id = ?`).bind(id).first();
      return (row as unknown as ProjectRecord) || null;
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

      // Count
      const countRow = await d1.prepare(
        `SELECT COUNT(*) AS total FROM feedback f WHERE ${where}`
      ).bind(...whereBinds).first();
      const total = (countRow?.total as number) || 0;

      // Data
      let rows: unknown[];
      if (userId) {
        // In the SQL, the ? for user_id in the LEFT JOIN ON clause comes BEFORE
        // the ? placeholders in the WHERE clause. Bind order must match.
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

    // --- Analytics ---
    async createEvent(input) {
      const isBotInt = input.is_bot ? 1 : 0;
      await d1.prepare(
        `INSERT INTO analytics_events (id, project_id, name, url, referrer, utm_source, utm_medium, utm_campaign, country, device, browser, screen_width, properties, os, is_bot, session_id, pathname)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        input.id, input.project_id, input.name, input.url, input.referrer,
        input.utm_source, input.utm_medium, input.utm_campaign, input.country,
        input.device, input.browser, input.screen_width, JSON.stringify(input.properties),
        input.os, isBotInt, input.session_id, input.pathname
      ).run();
      const row = await d1.prepare(`SELECT * FROM analytics_events WHERE id = ?`).bind(input.id).first();
      return row as unknown as EventRecord;
    },

    async getAnalyticsOverview(projectId, since) {
      const sinceStr = since.toISOString();
      const row = await d1.prepare(
        `SELECT
           COUNT(*) AS page_views,
           COUNT(DISTINCT (date(created_at) || '|' || COALESCE(country,'') || '|' || COALESCE(device,'') || '|' || COALESCE(browser,''))) AS unique_visitors
         FROM analytics_events
         WHERE project_id = ? AND name = 'page_view' AND created_at >= ?`
      ).bind(projectId, sinceStr).first();
      const topPage = await d1.prepare(
        `SELECT url, COUNT(*) AS cnt FROM analytics_events
         WHERE project_id = ? AND name = 'page_view' AND created_at >= ? AND url IS NOT NULL
         GROUP BY url ORDER BY cnt DESC LIMIT 1`
      ).bind(projectId, sinceStr).first();
      const topRef = await d1.prepare(
        `SELECT referrer, COUNT(*) AS cnt FROM analytics_events
         WHERE project_id = ? AND name = 'page_view' AND created_at >= ? AND referrer IS NOT NULL AND referrer != ''
         GROUP BY referrer ORDER BY cnt DESC LIMIT 1`
      ).bind(projectId, sinceStr).first();
      return {
        page_views: (row?.page_views as number) || 0,
        unique_visitors: (row?.unique_visitors as number) || 0,
        top_page: (topPage?.url as string) || null,
        top_referrer: (topRef?.referrer as string) || null,
      };
    },

    async getTopPages(projectId, since, limit) {
      const sinceStr = since.toISOString();
      const { results } = await d1.prepare(
        `SELECT url, COUNT(*) AS views FROM analytics_events
         WHERE project_id = ? AND name = 'page_view' AND created_at >= ? AND url IS NOT NULL
         GROUP BY url ORDER BY views DESC LIMIT ?`
      ).bind(projectId, sinceStr, limit).all();
      return results as unknown as { url: string; views: number }[];
    },

    async getTopReferrers(projectId, since, limit) {
      const sinceStr = since.toISOString();
      const { results } = await d1.prepare(
        `SELECT referrer, COUNT(*) AS count FROM analytics_events
         WHERE project_id = ? AND name = 'page_view' AND created_at >= ? AND referrer IS NOT NULL AND referrer != ''
         GROUP BY referrer ORDER BY count DESC LIMIT ?`
      ).bind(projectId, sinceStr, limit).all();
      return results as unknown as { referrer: string; count: number }[];
    },

    async getCountryBreakdown(projectId, since, limit) {
      const sinceStr = since.toISOString();
      const { results } = await d1.prepare(
        `SELECT country, COUNT(*) AS count FROM analytics_events
         WHERE project_id = ? AND created_at >= ? AND country IS NOT NULL
         GROUP BY country ORDER BY count DESC LIMIT ?`
      ).bind(projectId, sinceStr, limit).all();
      return results as unknown as { country: string; count: number }[];
    },

    async getDeviceBreakdown(projectId, since) {
      const sinceStr = since.toISOString();
      const { results } = await d1.prepare(
        `SELECT device, COUNT(*) AS count FROM analytics_events
         WHERE project_id = ? AND created_at >= ? AND device IS NOT NULL
         GROUP BY device ORDER BY count DESC`
      ).bind(projectId, sinceStr).all();
      return results as unknown as { device: string; count: number }[];
    },

    async getCustomEventCounts(projectId, since, limit) {
      const sinceStr = since.toISOString();
      const { results } = await d1.prepare(
        `SELECT name, COUNT(*) AS count FROM analytics_events
         WHERE project_id = ? AND created_at >= ? AND name != 'page_view'
         GROUP BY name ORDER BY count DESC LIMIT ?`
      ).bind(projectId, sinceStr, limit).all();
      return results as unknown as { name: string; count: number }[];
    },

    async getAnalyticsDashboard(projectId, since, includeBots, isToday) {
      const sinceStr = since.toISOString();
      const botClause = includeBots ? '' : 'AND is_bot = 0';
      const timeBucket = isToday
        ? `strftime('%Y-%m-%dT%H:00:00', created_at)`
        : `strftime('%Y-%m-%d', created_at)`;

      const [
        summaryRow,
        { results: timeseriesRows },
        { results: pagesRows },
        { results: referrersRows },
        { results: countriesRows },
        { results: devicesRows },
        { results: browsersRows },
        { results: osRows },
        { results: eventsRows },
        { results: botStatsRows },
        botTotalRow,
      ] = await Promise.all([
        // Summary
        d1.prepare(
          `SELECT
             COALESCE(SUM(session_pages), 0) AS page_views,
             COUNT(*) AS unique_visitors,
             COALESCE(
               ROUND(
                 CAST(SUM(CASE WHEN session_pages = 1 THEN 1 ELSE 0 END) AS REAL) * 100.0
                 / MAX(COUNT(*), 1),
                 1
               ), 0
             ) AS bounce_rate,
             COALESCE(ROUND(AVG(session_pages), 1), 0) AS avg_session_pages
           FROM (
             SELECT session_id, COUNT(*) AS session_pages
             FROM analytics_events
             WHERE project_id = ? AND name = 'page_view' AND created_at >= ? ${botClause}
             GROUP BY session_id
           ) sessions`
        ).bind(projectId, sinceStr).first(),
        // Timeseries
        d1.prepare(
          `SELECT
             ${timeBucket} AS date,
             COUNT(*) AS views,
             COUNT(DISTINCT session_id) AS visitors
           FROM analytics_events
           WHERE project_id = ? AND name = 'page_view' AND created_at >= ? ${botClause}
           GROUP BY 1
           ORDER BY 1`
        ).bind(projectId, sinceStr).all(),
        // Pages
        d1.prepare(
          `SELECT pathname, COUNT(*) AS views FROM analytics_events
           WHERE project_id = ? AND name = 'page_view' AND created_at >= ? AND pathname IS NOT NULL ${botClause}
           GROUP BY pathname ORDER BY views DESC LIMIT 10`
        ).bind(projectId, sinceStr).all(),
        // Referrers
        d1.prepare(
          `SELECT referrer, COUNT(*) AS count FROM analytics_events
           WHERE project_id = ? AND name = 'page_view' AND created_at >= ? AND referrer IS NOT NULL AND referrer != '' ${botClause}
           GROUP BY referrer ORDER BY count DESC LIMIT 10`
        ).bind(projectId, sinceStr).all(),
        // Countries
        d1.prepare(
          `SELECT country, COUNT(*) AS count FROM analytics_events
           WHERE project_id = ? AND created_at >= ? AND country IS NOT NULL ${botClause}
           GROUP BY country ORDER BY count DESC LIMIT 10`
        ).bind(projectId, sinceStr).all(),
        // Devices
        d1.prepare(
          `SELECT device, COUNT(*) AS count FROM analytics_events
           WHERE project_id = ? AND created_at >= ? AND device IS NOT NULL ${botClause}
           GROUP BY device ORDER BY count DESC LIMIT 10`
        ).bind(projectId, sinceStr).all(),
        // Browsers
        d1.prepare(
          `SELECT browser, COUNT(*) AS count FROM analytics_events
           WHERE project_id = ? AND created_at >= ? AND browser IS NOT NULL ${botClause}
           GROUP BY browser ORDER BY count DESC LIMIT 10`
        ).bind(projectId, sinceStr).all(),
        // OS
        d1.prepare(
          `SELECT os, COUNT(*) AS count FROM analytics_events
           WHERE project_id = ? AND created_at >= ? AND os IS NOT NULL ${botClause}
           GROUP BY os ORDER BY count DESC LIMIT 10`
        ).bind(projectId, sinceStr).all(),
        // Custom events
        d1.prepare(
          `SELECT name, COUNT(*) AS count FROM analytics_events
           WHERE project_id = ? AND created_at >= ? AND name != 'page_view' ${botClause}
           GROUP BY name ORDER BY count DESC LIMIT 10`
        ).bind(projectId, sinceStr).all(),
        // Bot stats (always full data, ignore includeBots)
        d1.prepare(
          `SELECT browser AS name, COUNT(*) AS count FROM analytics_events
           WHERE project_id = ? AND created_at >= ? AND is_bot = 1
           GROUP BY browser ORDER BY count DESC LIMIT 10`
        ).bind(projectId, sinceStr).all(),
        // Bot total for percentage
        d1.prepare(
          `SELECT
             SUM(CASE WHEN is_bot = 1 THEN 1 ELSE 0 END) AS bot_count,
             COUNT(*) AS total
           FROM analytics_events
           WHERE project_id = ? AND created_at >= ?`
        ).bind(projectId, sinceStr).first(),
      ]);

      const summary = summaryRow || { page_views: 0, unique_visitors: 0, bounce_rate: 0, avg_session_pages: 0 };
      const botTotal = botTotalRow || { bot_count: 0, total: 0 };

      return {
        summary: {
          page_views: (summary.page_views as number) || 0,
          unique_visitors: (summary.unique_visitors as number) || 0,
          bounce_rate: (summary.bounce_rate as number) || 0,
          avg_session_pages: (summary.avg_session_pages as number) || 0,
          bot_count: (botTotal.bot_count as number) || 0,
          bot_percentage: (botTotal.total as number) > 0
            ? Math.round((botTotal.bot_count as number) / (botTotal.total as number) * 1000) / 10
            : 0,
        },
        timeseries: timeseriesRows as unknown as { date: string; views: number; visitors: number }[],
        pages: pagesRows as unknown as { pathname: string; views: number }[],
        referrers: referrersRows as unknown as { referrer: string; count: number }[],
        countries: countriesRows as unknown as { country: string; count: number }[],
        devices: devicesRows as unknown as { device: string; count: number }[],
        browsers: browsersRows as unknown as { browser: string; count: number }[],
        os: osRows as unknown as { os: string; count: number }[],
        events: eventsRows as unknown as { name: string; count: number }[],
        bots: botStatsRows as unknown as { name: string; count: number }[],
      };
    },

    async getAnalyticsDetail(projectId, since, includeBots, section, limit, offset) {
      const sinceStr = since.toISOString();
      const botClause = includeBots ? '' : 'AND is_bot = 0';

      type QueryResult = { data: any[]; total: number };

      const buildQuery = async (
        selectExpr: string,
        whereExtra: string,
        groupByCol: string,
        orderByExpr: string,
        useBotFilter: boolean,
      ): Promise<QueryResult> => {
        const bf = useBotFilter ? botClause : '';
        const countRow = await d1.prepare(
          `SELECT COUNT(*) AS total FROM (
             SELECT 1 FROM analytics_events
             WHERE project_id = ? AND created_at >= ? ${whereExtra} ${bf}
             GROUP BY ${groupByCol}
           ) sub`
        ).bind(projectId, sinceStr).first();
        const { results } = await d1.prepare(
          `SELECT ${selectExpr} FROM analytics_events
           WHERE project_id = ? AND created_at >= ? ${whereExtra} ${bf}
           GROUP BY ${groupByCol}
           ORDER BY ${orderByExpr}
           LIMIT ? OFFSET ?`
        ).bind(projectId, sinceStr, limit, offset).all();
        return { data: results as unknown as any[], total: (countRow?.total as number) || 0 };
      };

      switch (section) {
        case 'pages':
          return buildQuery(
            'pathname, COUNT(*) AS views',
            "AND name = 'page_view' AND pathname IS NOT NULL",
            'pathname',
            'views DESC',
            true,
          );
        case 'referrers':
          return buildQuery(
            'referrer, COUNT(*) AS count',
            "AND name = 'page_view' AND referrer IS NOT NULL AND referrer != ''",
            'referrer',
            'count DESC',
            true,
          );
        case 'countries':
          return buildQuery(
            'country, COUNT(*) AS count',
            'AND country IS NOT NULL',
            'country',
            'count DESC',
            true,
          );
        case 'devices':
          return buildQuery(
            'device, COUNT(*) AS count',
            'AND device IS NOT NULL',
            'device',
            'count DESC',
            true,
          );
        case 'browsers':
          return buildQuery(
            'browser, COUNT(*) AS count',
            'AND browser IS NOT NULL',
            'browser',
            'count DESC',
            true,
          );
        case 'os':
          return buildQuery(
            'os, COUNT(*) AS count',
            'AND os IS NOT NULL',
            'os',
            'count DESC',
            true,
          );
        case 'events':
          return buildQuery(
            'name, COUNT(*) AS count',
            "AND name != 'page_view'",
            'name',
            'count DESC',
            true,
          );
        case 'bots':
          return buildQuery(
            'browser AS name, COUNT(*) AS count',
            'AND is_bot = 1',
            'browser',
            'count DESC',
            false,
          );
        default:
          return { data: [], total: 0 };
      }
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

    // --- Forms ---

    async createForm(input) {
      await d1.prepare(
        `INSERT INTO forms (id, project_id, title, slug, description, status, theme, settings)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(input.id, input.project_id, input.title, input.slug, input.description, input.status, JSON.stringify(input.theme), JSON.stringify(input.settings)).run();
      const row = await d1.prepare(`SELECT * FROM forms WHERE id = ?`).bind(input.id).first();
      return row as unknown as FormRecord;
    },

    async getFormById(id) {
      const row = await d1.prepare(`SELECT * FROM forms WHERE id = ?`).bind(id).first();
      return (row as unknown as FormRecord) || null;
    },

    async getFormBySlug(projectId, slug) {
      const row = await d1.prepare(
        `SELECT * FROM forms WHERE project_id = ? AND slug = ?`
      ).bind(projectId, slug).first();
      return (row as unknown as FormRecord) || null;
    },

    async getPublishedFormBySlug(slug) {
      const row = await d1.prepare(
        `SELECT f.*, p.api_key AS project_api_key
         FROM forms f
         JOIN projects p ON f.project_id = p.id
         WHERE f.slug = ? AND f.status = 'published'`
      ).bind(slug).first();
      return (row as unknown as (FormRecord & { project_api_key: string })) || null;
    },

    async listForms(projectId, page, limit) {
      const offset = (page - 1) * limit;
      const countRow = await d1.prepare(
        `SELECT COUNT(*) AS total FROM forms WHERE project_id = ?`
      ).bind(projectId).first();
      const { results } = await d1.prepare(
        `SELECT * FROM forms WHERE project_id = ?
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`
      ).bind(projectId, limit, offset).all();
      return { data: results as unknown as FormRecord[], total: (countRow?.total as number) || 0 };
    },

    async updateForm(id, input) {
      const sets: string[] = [];
      const values: unknown[] = [];
      if (input.title !== undefined) { sets.push('title = ?'); values.push(input.title); }
      if (input.slug !== undefined) { sets.push('slug = ?'); values.push(input.slug); }
      if (input.description !== undefined) { sets.push('description = ?'); values.push(input.description); }
      if (input.status !== undefined) { sets.push('status = ?'); values.push(input.status); }
      if (input.theme !== undefined) { sets.push('theme = ?'); values.push(JSON.stringify(input.theme)); }
      if (input.settings !== undefined) { sets.push('settings = ?'); values.push(JSON.stringify(input.settings)); }
      if (sets.length === 0) return null;
      sets.push("updated_at = datetime('now')");
      const sql = `UPDATE forms SET ${sets.join(', ')} WHERE id = ?`;
      values.push(id);
      await d1.prepare(sql).bind(...values).run();
      const row = await d1.prepare(`SELECT * FROM forms WHERE id = ?`).bind(id).first();
      return (row as unknown as FormRecord) || null;
    },

    async deleteForm(id) {
      const { meta } = await d1.prepare(`DELETE FROM forms WHERE id = ?`).bind(id).run();
      return (meta.changes ?? 0) > 0;
    },

    async getFormStats(projectId) {
      const row = await d1.prepare(
        `SELECT
           (SELECT COUNT(*) FROM forms WHERE project_id = ?) AS total_forms,
           (SELECT COUNT(*) FROM form_responses fr JOIN forms f ON fr.form_id = f.id WHERE f.project_id = ?) AS total_responses`
      ).bind(projectId, projectId).first();
      return {
        total_forms: (row?.total_forms as number) || 0,
        total_responses: (row?.total_responses as number) || 0,
      };
    },

    // --- Form Questions ---

    async upsertFormQuestions(formId, questions) {
      const questionIds = questions.filter(q => q.id).map(q => q.id);
      if (questionIds.length > 0) {
        const placeholders = questionIds.map(() => '?').join(', ');
        await d1.prepare(
          `DELETE FROM form_questions WHERE form_id = ? AND id NOT IN (${placeholders})`
        ).bind(formId, ...questionIds).run();
      } else {
        await d1.prepare(`DELETE FROM form_questions WHERE form_id = ?`).bind(formId).run();
      }
      const results: FormQuestionRecord[] = [];
      for (const q of questions) {
        await d1.prepare(
          `INSERT INTO form_questions (id, form_id, type, label, description, required, options, order_index)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET
             type = EXCLUDED.type,
             label = EXCLUDED.label,
             description = EXCLUDED.description,
             required = EXCLUDED.required,
             options = EXCLUDED.options,
             order_index = EXCLUDED.order_index`
        ).bind(q.id, formId, q.type, q.label, q.description, q.required ? 1 : 0, JSON.stringify(q.options), q.order_index).run();
        const row = await d1.prepare(`SELECT * FROM form_questions WHERE id = ?`).bind(q.id).first();
        results.push(row as unknown as FormQuestionRecord);
      }
      return results;
    },

    async listFormQuestions(formId) {
      const { results } = await d1.prepare(
        `SELECT * FROM form_questions WHERE form_id = ? ORDER BY order_index ASC`
      ).bind(formId).all();
      return results as unknown as FormQuestionRecord[];
    },

    async updateFormQuestion(id, input) {
      const sets: string[] = [];
      const values: unknown[] = [];
      if (input.type !== undefined) { sets.push('type = ?'); values.push(input.type); }
      if (input.label !== undefined) { sets.push('label = ?'); values.push(input.label); }
      if (input.description !== undefined) { sets.push('description = ?'); values.push(input.description); }
      if (input.required !== undefined) { sets.push('required = ?'); values.push(input.required ? 1 : 0); }
      if (input.options !== undefined) { sets.push('options = ?'); values.push(JSON.stringify(input.options)); }
      if (input.order_index !== undefined) { sets.push('order_index = ?'); values.push(input.order_index); }
      if (sets.length === 0) return null;
      const sql = `UPDATE form_questions SET ${sets.join(', ')} WHERE id = ?`;
      values.push(id);
      await d1.prepare(sql).bind(...values).run();
      const row = await d1.prepare(`SELECT * FROM form_questions WHERE id = ?`).bind(id).first();
      return (row as unknown as FormQuestionRecord) || null;
    },

    async deleteFormQuestion(id) {
      const { meta } = await d1.prepare(`DELETE FROM form_questions WHERE id = ?`).bind(id).run();
      return (meta.changes ?? 0) > 0;
    },

    // --- Form Responses ---

    async createFormResponse(input) {
      await d1.prepare(
        `INSERT INTO form_responses (id, form_id) VALUES (?, ?)`
      ).bind(input.id, input.form_id).run();
      const row = await d1.prepare(`SELECT * FROM form_responses WHERE id = ?`).bind(input.id).first();
      return row as unknown as FormResponseRecord;
    },

    async createFormAnswers(answers) {
      const results: FormAnswerRecord[] = [];
      for (const a of answers) {
        await d1.prepare(
          `INSERT INTO form_answers (id, response_id, question_id, value) VALUES (?, ?, ?, ?)`
        ).bind(a.id, a.response_id, a.question_id, a.value).run();
        const row = await d1.prepare(`SELECT * FROM form_answers WHERE id = ?`).bind(a.id).first();
        results.push(row as unknown as FormAnswerRecord);
      }
      return results;
    },

    async listFormResponses(formId, page, limit) {
      const offset = (page - 1) * limit;
      const countRow = await d1.prepare(
        `SELECT COUNT(*) AS total FROM form_responses WHERE form_id = ?`
      ).bind(formId).first();
      const { results: responses } = await d1.prepare(
        `SELECT * FROM form_responses WHERE form_id = ?
         ORDER BY submitted_at DESC
         LIMIT ? OFFSET ?`
      ).bind(formId, limit, offset).all();
      const data = [];
      for (const r of responses) {
        const { results: answers } = await d1.prepare(
          `SELECT * FROM form_answers WHERE response_id = ?`
        ).bind(r.id).all();
        data.push({ ...r, answers: answers as unknown as FormAnswerRecord[] });
      }
      return {
        data: data as (FormResponseRecord & { answers: FormAnswerRecord[] })[],
        total: (countRow?.total as number) || 0,
      };
    },

    async deleteFormResponse(id) {
      const { meta } = await d1.prepare(`DELETE FROM form_responses WHERE id = ?`).bind(id).run();
      return (meta.changes ?? 0) > 0;
    },

    async getFormResponseCount(formId) {
      const row = await d1.prepare(
        `SELECT COUNT(*) AS total FROM form_responses WHERE form_id = ?`
      ).bind(formId).first();
      return (row?.total as number) || 0;
    },

    async getFormAnswersByQuestionId(questionId) {
      const { results } = await d1.prepare(
        `SELECT * FROM form_answers WHERE question_id = ?`
      ).bind(questionId).all();
      return results as unknown as FormAnswerRecord[];
    },

    // --- CLI Auth ---
    async createCliAuthCode(code: string) {
      await d1.prepare(
        `INSERT INTO cli_auth_codes (code, expires_at) VALUES (?, datetime('now', '+10 minutes'))`
      ).bind(code).run();
    },

    async getCliAuthCode(code: string) {
      const row = await d1.prepare(`SELECT * FROM cli_auth_codes WHERE code = ?`).bind(code).first();
      return row as unknown as { code: string; user_id: string | null; status: string; token: string | null; expires_at: string } | undefined;
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
        `INSERT INTO changelog_entries (id, project_id, title, content, version, type, published, published_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(input.id, input.project_id, input.title, input.content, input.version, input.type, publishedInt, input.published_at).run();
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

    // --- AI Gateway ---

    async getProjectAIConfig(projectId: string): Promise<{ ai_base_url: string | null; ai_api_key: string | null; ai_model: string | null }> {
      const row = await d1.prepare(
        `SELECT ai_base_url, ai_api_key, ai_model FROM projects WHERE id = ?`
      ).bind(projectId).first();
      if (!row) throw new Error('Project not found');
      return { ai_base_url: row.ai_base_url as string | null, ai_api_key: row.ai_api_key as string | null, ai_model: row.ai_model as string | null };
    },

    async updateProjectAIConfig(projectId: string, config: { ai_base_url: string; ai_api_key: string; ai_model: string }): Promise<void> {
      await d1.prepare(
        `UPDATE projects SET ai_base_url = ?, ai_api_key = ?, ai_model = ? WHERE id = ?`
      ).bind(config.ai_base_url, config.ai_api_key, config.ai_model, projectId).run();
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

    async listAIRequests(projectId: string, limit: number = 50, offset: number = 0): Promise<{ data: any[]; total: number }> {
      const countRow = await d1.prepare(
        `SELECT COUNT(*) AS total FROM ai_requests WHERE project_id = ?`
      ).bind(projectId).first();
      const { results } = await d1.prepare(
        `SELECT * FROM ai_requests WHERE project_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`
      ).bind(projectId, limit, offset).all();
      return { data: results as unknown as any[], total: (countRow?.total as number) || 0 };
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
      return (row as any).next_pos as number;
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
      await d1.prepare(
        `UPDATE roadmap_items SET upvote_count = ?, downvote_count = ? WHERE id = ?`
      ).bind((counts as any).up, (counts as any).down, input.roadmap_item_id).run();
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
        await d1.prepare(
          `UPDATE roadmap_items SET upvote_count = ?, downvote_count = ? WHERE id = ?`
        ).bind((counts as any).up, (counts as any).down, roadmapItemId).run();
      }
      return (meta.changes ?? 0) > 0;
    },

    async getRoadmapVote(roadmapItemId, userIdentifier) {
      const row = await d1.prepare(
        `SELECT vote FROM roadmap_votes WHERE roadmap_item_id = ? AND user_identifier = ?`
      ).bind(roadmapItemId, userIdentifier).first();
      if (!row) return null;
      return (row as any).vote === 1 ? 1 : -1;
    },

    // --- Directory ---
    async createDirectoryListing(input) {
      await d1.prepare(
        `INSERT INTO directory_listings (id, name, tagline, url, description, logo_url, screenshot_url, twitter_url, project_id, tags)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(input.id, input.name, input.tagline, input.url, input.description, input.logo_url, input.screenshot_url, input.twitter_url, input.project_id, JSON.stringify(input.tags)).run();
      const row = await d1.prepare(`SELECT * FROM directory_listings WHERE id = ?`).bind(input.id).first();
      return row as any;
    },

    async listDirectoryListings(page, limit, tag?, search?, status = 'approved' as any) {
      const offset = (page - 1) * limit;
      const conditions: string[] = ['status = ?'];
      const bindValues: unknown[] = [status];

      if (tag) {
        conditions.push(`tags LIKE '%"' || ? || '"%'`);
        bindValues.push(tag);
      }
      if (search) {
        conditions.push(`(name LIKE ? OR tagline LIKE ?)`);
        bindValues.push(`%${search}%`, `%${search}%`);
      }

      const where = conditions.join(' AND ');

      const { results } = await d1.prepare(
        `SELECT * FROM directory_listings WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
      ).bind(...bindValues, limit, offset).all();

      const countRow = await d1.prepare(
        `SELECT COUNT(*) AS count FROM directory_listings WHERE ${where}`
      ).bind(...bindValues).first();

      return { data: results as any[], total: (countRow?.count as number) || 0 };
    },

    async getDirectoryListingById(id) {
      const row = await d1.prepare(`SELECT * FROM directory_listings WHERE id = ?`).bind(id).first();
      return (row as any) || null;
    },

    async getDirectoryListingByProjectId(projectId) {
      const row = await d1.prepare(
        `SELECT * FROM directory_listings WHERE project_id = ? LIMIT 1`
      ).bind(projectId).first();
      return (row as any) || null;
    },

    async updateDirectoryListingBadgeVerified(id, verified) {
      await d1.prepare(
        `UPDATE directory_listings SET badge_verified = ? WHERE id = ?`
      ).bind(verified ? 1 : 0, id).run();
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
      return row as any;
    },

    async getAIMentionConfig(projectId) {
      const row = await d1.prepare(`SELECT * FROM ai_mention_configs WHERE project_id = ?`).bind(projectId).first();
      return (row as any) || null;
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
      return row as any;
    },

    async listAIMentionPrompts(projectId) {
      const { results } = await d1.prepare(
        `SELECT * FROM ai_mention_prompts WHERE project_id = ? ORDER BY created_at ASC`
      ).bind(projectId).all();
      return results as any[];
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
      return row as any;
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
      return (row as any) || null;
    },

    async listAIMentionChecks(projectId, limit = 10) {
      const { results } = await d1.prepare(
        `SELECT * FROM ai_mention_checks WHERE project_id = ? ORDER BY created_at DESC LIMIT ?`
      ).bind(projectId, limit).all();
      return results as any[];
    },

    async getAIMentionCheckById(id) {
      const row = await d1.prepare(`SELECT * FROM ai_mention_checks WHERE id = ?`).bind(id).first();
      return (row as any) || null;
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
      return results as any[];
    },
  };
}
