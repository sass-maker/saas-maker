import postgres from 'postgres';
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
  ShortLinkRecord,
  TestimonialRecord,
  ChangelogEntryRecord,
  FormRecord,
  FormQuestionRecord,
  FormResponseRecord,
  FormAnswerRecord,
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

export function createDatabase(databaseUrl: string, useSSL = true): FeedbackDatabase {
  const sql = postgres(databaseUrl, { ssl: useSSL ? 'require' : false });

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
        INSERT INTO feedback (id, project_id, type, status, title, description, image_url, submitter_email, submitter_name)
        VALUES (
          ${input.id},
          ${input.project_id},
          ${input.type},
          ${input.status ?? (input.type === 'feature' ? 'planned' : 'new')},
          ${input.title},
          ${input.description},
          ${input.image_url},
          ${input.submitter_email},
          ${input.submitter_name}
        )
        RETURNING *, NULL::smallint AS viewer_vote
      `;
      return toFeedbackRecord(row as unknown as Record<string, unknown>);
    },

    async getFeedbackById(id) {
      const [row] = await sql`SELECT *, NULL::smallint AS viewer_vote FROM feedback WHERE id = ${id}`;
      return row ? toFeedbackRecord(row as unknown as Record<string, unknown>) : null;
    },

    async listFeedback(projectId, query, userId) {
      const { type, status, sort = 'newest', page = 1, limit = 20 } = query;
      const offset = (page - 1) * limit;

      // Build WHERE conditions
      const conditions = [sql`f.project_id = ${projectId}`];
      if (type) conditions.push(sql`f.type = ${type}`);
      if (status) conditions.push(sql`f.status = ${status}`);

      const where = conditions.reduce((acc, cond, i) =>
        i === 0 ? cond : sql`${acc} AND ${cond}`
      );

      const orderBy =
        sort === 'upvotes'
          ? sql`f.upvote_count DESC, f.created_at DESC`
          : sql`f.created_at DESC`;

      const [countResult] = await sql`SELECT COUNT(*)::int as total FROM feedback f WHERE ${where}`;
      const rows = userId
        ? await sql`
            SELECT f.*, v.vote AS viewer_vote
            FROM feedback f
            LEFT JOIN upvotes v ON v.feedback_id = f.id AND v.user_id = ${userId}
            WHERE ${where}
            ORDER BY ${orderBy}
            LIMIT ${limit} OFFSET ${offset}
          `
        : await sql`
            SELECT f.*, NULL::smallint AS viewer_vote
            FROM feedback f
            WHERE ${where}
            ORDER BY ${orderBy}
            LIMIT ${limit} OFFSET ${offset}
          `;

      return {
        data: (rows as unknown as Record<string, unknown>[]).map(toFeedbackRecord),
        total: countResult.total,
      };
    },

    async updateFeedbackStatus(id, status) {
      const [row] = await sql`
        UPDATE feedback
        SET status = ${status}
        WHERE id = ${id}
        RETURNING *, NULL::smallint AS viewer_vote
      `;
      return row ? toFeedbackRecord(row as unknown as Record<string, unknown>) : null;
    },

    async deleteFeedback(id) {
      const result = await sql`DELETE FROM feedback WHERE id = ${id}`;
      return result.count > 0;
    },

    // --- Votes ---
    async setVote(input) {
      const [existing] = await sql`
        SELECT *
        FROM upvotes
        WHERE feedback_id = ${input.feedback_id} AND user_id = ${input.user_id}
      `;

      if (!existing) {
        const [inserted] = await sql`
          INSERT INTO upvotes (id, feedback_id, user_id, vote)
          VALUES (${input.id}, ${input.feedback_id}, ${input.user_id}, ${input.vote})
          RETURNING *
        `;
        if (input.vote === 1) {
          await sql`UPDATE feedback SET upvote_count = upvote_count + 1 WHERE id = ${input.feedback_id}`;
        } else {
          await sql`UPDATE feedback SET downvote_count = downvote_count + 1 WHERE id = ${input.feedback_id}`;
        }
        return inserted as UpvoteRecord;
      }

      const existingVote = Number(existing.vote) as 1 | -1;
      if (existingVote === input.vote) {
        return existing as UpvoteRecord;
      }

      const [updated] = await sql`
        UPDATE upvotes
        SET vote = ${input.vote}
        WHERE id = ${existing.id}
        RETURNING *
      `;

      if (existingVote === 1 && input.vote === -1) {
        await sql`
          UPDATE feedback
          SET upvote_count = GREATEST(upvote_count - 1, 0),
              downvote_count = downvote_count + 1
          WHERE id = ${input.feedback_id}
        `;
      } else if (existingVote === -1 && input.vote === 1) {
        await sql`
          UPDATE feedback
          SET downvote_count = GREATEST(downvote_count - 1, 0),
              upvote_count = upvote_count + 1
          WHERE id = ${input.feedback_id}
        `;
      }

      return updated as UpvoteRecord;
    },

    async removeVote(feedbackId, userId) {
      const [existing] = await sql`
        SELECT *
        FROM upvotes
        WHERE feedback_id = ${feedbackId} AND user_id = ${userId}
      `;
      if (!existing) return false;

      await sql`DELETE FROM upvotes WHERE id = ${existing.id}`;

      if (Number(existing.vote) === 1) {
        await sql`
          UPDATE feedback
          SET upvote_count = GREATEST(upvote_count - 1, 0)
          WHERE id = ${feedbackId}
        `;
      } else {
        await sql`
          UPDATE feedback
          SET downvote_count = GREATEST(downvote_count - 1, 0)
          WHERE id = ${feedbackId}
        `;
      }

      return true;
    },

    async hasUpvoted(feedbackId, userId) {
      const [row] = await sql`
        SELECT 1
        FROM upvotes
        WHERE feedback_id = ${feedbackId} AND user_id = ${userId} AND vote = 1
      `;
      return !!row;
    },

    async hasDownvoted(feedbackId, userId) {
      const [row] = await sql`
        SELECT 1
        FROM upvotes
        WHERE feedback_id = ${feedbackId} AND user_id = ${userId} AND vote = -1
      `;
      return !!row;
    },

    async getUserVote(feedbackId, userId) {
      const [row] = await sql`
        SELECT vote
        FROM upvotes
        WHERE feedback_id = ${feedbackId} AND user_id = ${userId}
      `;
      return parseViewerVote(row?.vote);
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

    // --- Short Links ---
    async createShortLink(input) {
      const [row] = await sql`
        INSERT INTO short_links (id, project_id, slug, destination, title, expires_at)
        VALUES (${input.id}, ${input.project_id}, ${input.slug}, ${input.destination}, ${input.title}, ${input.expires_at})
        RETURNING *
      `;
      return row as ShortLinkRecord;
    },

    async getShortLinkBySlug(slug) {
      const [row] = await sql`SELECT * FROM short_links WHERE slug = ${slug}`;
      return (row as ShortLinkRecord) || null;
    },

    async getShortLinkById(id) {
      const [row] = await sql`SELECT * FROM short_links WHERE id = ${id}`;
      return (row as ShortLinkRecord) || null;
    },

    async listShortLinks(projectId, page, limit) {
      const offset = (page - 1) * limit;
      const [countResult] = await sql`
        SELECT COUNT(*)::int AS total FROM short_links WHERE project_id = ${projectId}
      `;
      const rows = await sql`
        SELECT * FROM short_links WHERE project_id = ${projectId}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      return { data: rows as unknown as ShortLinkRecord[], total: countResult.total };
    },

    async updateShortLink(id, input) {
      const sets = [];
      if (input.destination !== undefined) sets.push(sql`destination = ${input.destination}`);
      if (input.title !== undefined) sets.push(sql`title = ${input.title}`);
      if (input.expires_at !== undefined) sets.push(sql`expires_at = ${input.expires_at}`);
      sets.push(sql`updated_at = NOW()`);

      const setClause = sets.reduce((acc, s, i) => i === 0 ? s : sql`${acc}, ${s}`);
      const [row] = await sql`UPDATE short_links SET ${setClause} WHERE id = ${id} RETURNING *`;
      return (row as ShortLinkRecord) || null;
    },

    async deleteShortLink(id) {
      const result = await sql`DELETE FROM short_links WHERE id = ${id}`;
      return result.count > 0;
    },

    async incrementLinkClickCount(id) {
      await sql`UPDATE short_links SET click_count = click_count + 1 WHERE id = ${id}`;
    },

    async getShortLinkStats(linkId, projectId) {
      const [link] = await sql`SELECT slug FROM short_links WHERE id = ${linkId}`;
      const slug = link?.slug || '';

      const [totalRow] = await sql`
        SELECT COUNT(*)::int AS total FROM events
        WHERE project_id = ${projectId} AND name = 'link_click' AND properties->>'link_id' = ${linkId}
      `;

      const byCountry = await sql`
        SELECT country, COUNT(*)::int AS count FROM events
        WHERE project_id = ${projectId} AND name = 'link_click' AND properties->>'link_id' = ${linkId} AND country IS NOT NULL
        GROUP BY country ORDER BY count DESC
      `;

      const byDevice = await sql`
        SELECT device, COUNT(*)::int AS count FROM events
        WHERE project_id = ${projectId} AND name = 'link_click' AND properties->>'link_id' = ${linkId} AND device IS NOT NULL
        GROUP BY device ORDER BY count DESC
      `;

      const byReferrer = await sql`
        SELECT referrer, COUNT(*)::int AS count FROM events
        WHERE project_id = ${projectId} AND name = 'link_click' AND properties->>'link_id' = ${linkId} AND referrer IS NOT NULL AND referrer != ''
        GROUP BY referrer ORDER BY count DESC
      `;

      const overTime = await sql`
        SELECT created_at::date::text AS date, COUNT(*)::int AS count FROM events
        WHERE project_id = ${projectId} AND name = 'link_click' AND properties->>'link_id' = ${linkId}
        GROUP BY created_at::date ORDER BY date
      `;

      return {
        link_id: linkId,
        slug,
        total_clicks: totalRow.total,
        clicks_by_country: byCountry as unknown as { country: string; count: number }[],
        clicks_by_device: byDevice as unknown as { device: string; count: number }[],
        clicks_by_referrer: byReferrer as unknown as { referrer: string; count: number }[],
        clicks_over_time: overTime as unknown as { date: string; count: number }[],
      };
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
      const [row] = await sql`
        INSERT INTO testimonials (id, project_id, author_name, author_email, author_avatar_url, author_title, content, rating, image_url, tweet_url)
        VALUES (${input.id}, ${input.project_id}, ${input.author_name}, ${input.author_email}, ${input.author_avatar_url}, ${input.author_title}, ${input.content}, ${input.rating}, ${input.image_url}, ${input.tweet_url})
        RETURNING *
      `;
      return row as TestimonialRecord;
    },

    async listApprovedTestimonials(projectId: string, limit = 50, sort: 'newest' | 'rating' = 'newest') {
      const orderClause = sort === 'rating' ? sql`rating DESC, created_at DESC` : sql`created_at DESC`;
      const rows = await sql`
        SELECT * FROM testimonials
        WHERE project_id = ${projectId} AND status = 'approved'
        ORDER BY ${orderClause}
        LIMIT ${limit}
      `;
      return rows as unknown as TestimonialRecord[];
    },

    async listAllTestimonials(projectId: string, page: number, limit: number) {
      const offset = (page - 1) * limit;
      const [countResult] = await sql`
        SELECT COUNT(*)::int AS total FROM testimonials WHERE project_id = ${projectId}
      `;
      const rows = await sql`
        SELECT * FROM testimonials WHERE project_id = ${projectId}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      return { data: rows as unknown as TestimonialRecord[], total: countResult.total };
    },

    async getTestimonialStats(projectId: string) {
      const [row] = await sql`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
          COUNT(*) FILTER (WHERE status = 'approved')::int AS approved,
          COALESCE(AVG(rating) FILTER (WHERE status = 'approved'), 0)::float AS avg_rating
        FROM testimonials WHERE project_id = ${projectId}
      `;
      return row as { total: number; pending: number; approved: number; avg_rating: number };
    },

    async updateTestimonialStatus(id: string, status: string) {
      const [row] = await sql`
        UPDATE testimonials SET status = ${status} WHERE id = ${id} RETURNING *
      `;
      return (row as TestimonialRecord) || null;
    },

    async deleteTestimonial(id: string) {
      const result = await sql`DELETE FROM testimonials WHERE id = ${id}`;
      return result.count > 0;
    },

    async getTestimonialById(id: string) {
      const [row] = await sql`SELECT * FROM testimonials WHERE id = ${id}`;
      return (row as TestimonialRecord) || null;
    },

    // --- Forms ---

    async createForm(input) {
      const [row] = await sql`
        INSERT INTO forms (id, project_id, title, slug, description, status, theme, settings)
        VALUES (${input.id}, ${input.project_id}, ${input.title}, ${input.slug}, ${input.description}, ${input.status}, ${JSON.stringify(input.theme)}, ${JSON.stringify(input.settings)})
        RETURNING *
      `;
      return row as FormRecord;
    },

    async getFormById(id) {
      const [row] = await sql`SELECT * FROM forms WHERE id = ${id}`;
      return (row as FormRecord) || null;
    },

    async getFormBySlug(projectId, slug) {
      const [row] = await sql`SELECT * FROM forms WHERE project_id = ${projectId} AND slug = ${slug}`;
      return (row as FormRecord) || null;
    },

    async getPublishedFormBySlug(slug) {
      const [row] = await sql`
        SELECT f.*, p.api_key AS project_api_key
        FROM forms f
        JOIN projects p ON f.project_id = p.id
        WHERE f.slug = ${slug} AND f.status = 'published'
      `;
      return (row as (FormRecord & { project_api_key: string })) || null;
    },

    async listForms(projectId, page, limit) {
      const offset = (page - 1) * limit;
      const [countResult] = await sql`
        SELECT COUNT(*)::int AS total FROM forms WHERE project_id = ${projectId}
      `;
      const rows = await sql`
        SELECT * FROM forms WHERE project_id = ${projectId}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      return { data: rows as unknown as FormRecord[], total: countResult.total };
    },

    async updateForm(id, input) {
      const sets: string[] = [];
      const values: (string | null | boolean)[] = [];
      if (input.title !== undefined) { sets.push('title'); values.push(input.title); }
      if (input.slug !== undefined) { sets.push('slug'); values.push(input.slug); }
      if (input.description !== undefined) { sets.push('description'); values.push(input.description); }
      if (input.status !== undefined) { sets.push('status'); values.push(input.status); }
      if (input.theme !== undefined) { sets.push('theme'); values.push(JSON.stringify(input.theme)); }
      if (input.settings !== undefined) { sets.push('settings'); values.push(JSON.stringify(input.settings)); }
      if (sets.length === 0) return null;
      const setClauses = sets.map((col, i) => `${col} = $${i + 2}`).join(', ');
      const result = await sql.unsafe(
        `UPDATE forms SET ${setClauses}, updated_at = now() WHERE id = $1 RETURNING *`,
        [id, ...values]
      );
      return (result[0] as unknown as FormRecord) || null;
    },

    async deleteForm(id) {
      const result = await sql`DELETE FROM forms WHERE id = ${id}`;
      return result.count > 0;
    },

    async getFormStats(projectId) {
      const [result] = await sql`
        SELECT
          (SELECT COUNT(*)::int FROM forms WHERE project_id = ${projectId}) AS total_forms,
          (SELECT COUNT(*)::int FROM form_responses fr JOIN forms f ON fr.form_id = f.id WHERE f.project_id = ${projectId}) AS total_responses
      `;
      return { total_forms: result.total_forms, total_responses: result.total_responses };
    },

    // --- Form Questions ---

    async upsertFormQuestions(formId, questions) {
      const questionIds = questions.filter(q => q.id).map(q => q.id);
      if (questionIds.length > 0) {
        await sql`DELETE FROM form_questions WHERE form_id = ${formId} AND id NOT IN ${sql(questionIds)}`;
      } else {
        await sql`DELETE FROM form_questions WHERE form_id = ${formId}`;
      }
      const results: FormQuestionRecord[] = [];
      for (const q of questions) {
        const [row] = await sql`
          INSERT INTO form_questions (id, form_id, type, label, description, required, options, order_index)
          VALUES (${q.id}, ${formId}, ${q.type}, ${q.label}, ${q.description}, ${q.required}, ${JSON.stringify(q.options)}, ${q.order_index})
          ON CONFLICT (id) DO UPDATE SET
            type = EXCLUDED.type,
            label = EXCLUDED.label,
            description = EXCLUDED.description,
            required = EXCLUDED.required,
            options = EXCLUDED.options,
            order_index = EXCLUDED.order_index
          RETURNING *
        `;
        results.push(row as FormQuestionRecord);
      }
      return results;
    },

    async listFormQuestions(formId) {
      const rows = await sql`SELECT * FROM form_questions WHERE form_id = ${formId} ORDER BY order_index ASC`;
      return rows as unknown as FormQuestionRecord[];
    },

    async updateFormQuestion(id, input) {
      const sets: string[] = [];
      const values: (string | number | null | boolean)[] = [];
      if (input.type !== undefined) { sets.push('type'); values.push(input.type); }
      if (input.label !== undefined) { sets.push('label'); values.push(input.label); }
      if (input.description !== undefined) { sets.push('description'); values.push(input.description); }
      if (input.required !== undefined) { sets.push('required'); values.push(input.required); }
      if (input.options !== undefined) { sets.push('options'); values.push(JSON.stringify(input.options)); }
      if (input.order_index !== undefined) { sets.push('order_index'); values.push(input.order_index); }
      if (sets.length === 0) return null;
      const setClauses = sets.map((col, i) => `${col} = $${i + 2}`).join(', ');
      const result = await sql.unsafe(
        `UPDATE form_questions SET ${setClauses} WHERE id = $1 RETURNING *`,
        [id, ...values]
      );
      return (result[0] as unknown as FormQuestionRecord) || null;
    },

    async deleteFormQuestion(id) {
      const result = await sql`DELETE FROM form_questions WHERE id = ${id}`;
      return result.count > 0;
    },

    // --- Form Responses ---

    async createFormResponse(input) {
      const [row] = await sql`
        INSERT INTO form_responses (id, form_id)
        VALUES (${input.id}, ${input.form_id})
        RETURNING *
      `;
      return row as FormResponseRecord;
    },

    async createFormAnswers(answers) {
      const results: FormAnswerRecord[] = [];
      for (const a of answers) {
        const [row] = await sql`
          INSERT INTO form_answers (id, response_id, question_id, value)
          VALUES (${a.id}, ${a.response_id}, ${a.question_id}, ${a.value})
          RETURNING *
        `;
        results.push(row as FormAnswerRecord);
      }
      return results;
    },

    async listFormResponses(formId, page, limit) {
      const offset = (page - 1) * limit;
      const [countResult] = await sql`
        SELECT COUNT(*)::int AS total FROM form_responses WHERE form_id = ${formId}
      `;
      const responses = await sql`
        SELECT * FROM form_responses WHERE form_id = ${formId}
        ORDER BY submitted_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      const data = [];
      for (const r of responses) {
        const answers = await sql`
          SELECT * FROM form_answers WHERE response_id = ${r.id}
        `;
        data.push({ ...r, answers: answers as unknown as FormAnswerRecord[] });
      }
      return { data: data as (FormResponseRecord & { answers: FormAnswerRecord[] })[], total: countResult.total };
    },

    async deleteFormResponse(id) {
      const result = await sql`DELETE FROM form_responses WHERE id = ${id}`;
      return result.count > 0;
    },

    async getFormResponseCount(formId) {
      const [result] = await sql`SELECT COUNT(*)::int AS total FROM form_responses WHERE form_id = ${formId}`;
      return result.total;
    },

    async getFormAnswersByQuestionId(questionId) {
      const rows = await sql`SELECT * FROM form_answers WHERE question_id = ${questionId}`;
      return rows as unknown as FormAnswerRecord[];
    },

    // --- CLI Auth ---
    async createCliAuthCode(code: string) {
      await sql`
        INSERT INTO cli_auth_codes (code, expires_at)
        VALUES (${code}, now() + interval '10 minutes')
      `;
    },

    async getCliAuthCode(code: string) {
      const [row] = await sql`SELECT * FROM cli_auth_codes WHERE code = ${code}`;
      return row as { code: string; user_id: string | null; status: string; token: string | null; expires_at: string } | undefined;
    },

    async approveCliAuthCode(code: string, userId: string, token: string) {
      await sql`
        UPDATE cli_auth_codes
        SET status = 'approved', user_id = ${userId}, token = ${token}
        WHERE code = ${code}
      `;
    },

    async deleteCliAuthCode(code: string) {
      await sql`DELETE FROM cli_auth_codes WHERE code = ${code}`;
    },

    async createCliToken(token: string, userId: string) {
      await sql`INSERT INTO cli_tokens (token, user_id) VALUES (${token}, ${userId})`;
    },

    async getCliTokenUser(token: string) {
      const [row] = await sql`SELECT user_id FROM cli_tokens WHERE token = ${token}`;
      return row as { user_id: string } | undefined;
    },

    // --- Changelog ---
    async createChangelogEntry(input) {
      const [row] = await sql`
        INSERT INTO changelog_entries (id, project_id, title, content, version, type, published, published_at)
        VALUES (${input.id}, ${input.project_id}, ${input.title}, ${input.content}, ${input.version}, ${input.type}, ${input.published}, ${input.published_at})
        RETURNING *
      `;
      return row as ChangelogEntryRecord;
    },

    async updateChangelogEntry(id, input) {
      const sets = [];
      if (input.title !== undefined) sets.push(sql`title = ${input.title}`);
      if (input.content !== undefined) sets.push(sql`content = ${input.content}`);
      if (input.version !== undefined) sets.push(sql`version = ${input.version}`);
      if (input.type !== undefined) sets.push(sql`type = ${input.type}`);
      if (input.published !== undefined) {
        sets.push(sql`published = ${input.published}`);
        if (input.published) {
          sets.push(sql`published_at = COALESCE(published_at, NOW())`);
        } else {
          sets.push(sql`published_at = NULL`);
        }
      }
      sets.push(sql`updated_at = NOW()`);

      const setClause = sets.reduce((acc, s, i) => i === 0 ? s : sql`${acc}, ${s}`);
      const [row] = await sql`UPDATE changelog_entries SET ${setClause} WHERE id = ${id} RETURNING *`;
      return (row as ChangelogEntryRecord) || null;
    },

    async deleteChangelogEntry(id) {
      const result = await sql`DELETE FROM changelog_entries WHERE id = ${id}`;
      return result.count > 0;
    },

    async getChangelogEntryById(id) {
      const [row] = await sql`SELECT * FROM changelog_entries WHERE id = ${id}`;
      return (row as ChangelogEntryRecord) || null;
    },

    async listChangelogEntries(projectId, page, limit) {
      const offset = (page - 1) * limit;
      const [countResult] = await sql`
        SELECT COUNT(*)::int AS total FROM changelog_entries WHERE project_id = ${projectId}
      `;
      const rows = await sql`
        SELECT * FROM changelog_entries WHERE project_id = ${projectId}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      return { data: rows as unknown as ChangelogEntryRecord[], total: countResult.total };
    },

    async listPublishedChangelog(projectId, limit) {
      const rows = await sql`
        SELECT * FROM changelog_entries
        WHERE project_id = ${projectId} AND published = true
        ORDER BY published_at DESC
        LIMIT ${limit}
      `;
      return rows as unknown as ChangelogEntryRecord[];
    },

    async getChangelogStats(projectId) {
      const [row] = await sql`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE published = true)::int AS published,
          COUNT(*) FILTER (WHERE published = false)::int AS drafts
        FROM changelog_entries WHERE project_id = ${projectId}
      `;
      return row as { total: number; published: number; drafts: number };
    },
  };
}

export function getDb(databaseUrl: string, hyperdrive?: Hyperdrive): FeedbackDatabase {
  // Hyperdrive proxies the connection locally — no SSL needed (Hyperdrive handles TLS to origin)
  if (hyperdrive) {
    return createDatabase(hyperdrive.connectionString, false);
  }
  return createDatabase(databaseUrl, true);
}
