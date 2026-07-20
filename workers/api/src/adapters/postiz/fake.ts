import { PostizError } from './errors';
import type {
  PostizAnalyticsMetric,
  PostizCreatePayload,
  PostizCreateReceipt,
  PostizGateway,
  PostizHealth,
  PostizIntegration,
  PostizPostRecord,
} from './types';

export const FAKE_POSTIZ_FIXTURE_SCHEMA = 'foundry.fake-postiz.v1' as const;

export interface FakePostizFixture {
  schema: typeof FAKE_POSTIZ_FIXTURE_SCHEMA;
  mode: 'inert';
  connected: boolean;
  integrations: PostizIntegration[];
  posts: PostizPostRecord[];
  analytics: {
    post_by_integration: Record<string, PostizAnalyticsMetric[]>;
    platform_by_integration: Record<string, PostizAnalyticsMetric[]>;
  };
}

/** Credential-free, in-memory harness. It never constructs a network client or external writer. */
export class FakePostizHarness implements PostizGateway {
  readonly mode = 'inert' as const;
  readonly externalRequests = 0;
  private readonly fixture: FakePostizFixture;
  private readonly posts: PostizPostRecord[];
  private nextPostId: number;

  constructor(input: unknown) {
    this.fixture = validateFixture(input);
    this.posts = structuredClone(this.fixture.posts);
    this.nextPostId = this.posts.length + 1;
  }

  async health(): Promise<PostizHealth> {
    return { connected: this.fixture.connected };
  }

  async listIntegrations(): Promise<PostizIntegration[]> {
    return structuredClone(this.fixture.integrations);
  }

  async createPost(payload: PostizCreatePayload): Promise<PostizCreateReceipt[]> {
    if (!['draft', 'schedule', 'now'].includes(payload.type) || !isIsoDate(payload.date)) {
      throw fixtureError('create payload requires a supported type and ISO date');
    }
    return payload.posts.map((requestedPost) => {
      const integration = this.fixture.integrations.find(
        (entry) => entry.id === requestedPost.integration.id && !entry.disabled
      );
      if (!integration) throw fixtureError('create payload references an unavailable integration');
      const id = `fake-post-${this.nextPostId++}`;
      this.posts.push({
        id,
        publishDate: payload.date,
        releaseURL: null,
        releaseId: null,
        state:
          payload.type === 'draft' ? 'DRAFT' : payload.type === 'schedule' ? 'QUEUE' : 'PUBLISHED',
        integration: {
          id: integration.id,
          providerIdentifier: integration.identifier,
          name: integration.name,
        },
      });
      return { postId: id, integration: integration.id };
    });
  }

  async listPosts(query: { startDate: string; endDate: string }): Promise<PostizPostRecord[]> {
    if (!isIsoDate(query.startDate) || !isIsoDate(query.endDate)) {
      throw fixtureError('post list dates must be ISO timestamps');
    }
    const start = Date.parse(query.startDate);
    const end = Date.parse(query.endDate);
    return structuredClone(
      this.posts.filter((post) => {
        const publishedAt = Date.parse(post.publishDate);
        return publishedAt >= start && publishedAt <= end;
      })
    );
  }

  async changePostStatus(
    postId: string,
    status: 'draft' | 'schedule'
  ): Promise<{ id: string; state: 'DRAFT' | 'QUEUE' }> {
    const post = this.posts.find((entry) => entry.id === postId);
    if (!post) throw fixtureError(`unknown fake post: ${postId}`);
    const state = status === 'draft' ? 'DRAFT' : 'QUEUE';
    post.state = state;
    return { id: postId, state };
  }

  async getPostAnalytics(postId: string, days: number): Promise<PostizAnalyticsMetric[]> {
    validateDays(days);
    const post = this.posts.find((entry) => entry.id === postId);
    if (!post) throw fixtureError(`unknown fake post: ${postId}`);
    return structuredClone(this.fixture.analytics.post_by_integration[post.integration.id] ?? []);
  }

  async getPlatformAnalytics(
    integrationId: string,
    days: number
  ): Promise<PostizAnalyticsMetric[]> {
    validateDays(days);
    if (!this.fixture.integrations.some((entry) => entry.id === integrationId)) {
      throw fixtureError(`unknown fake integration: ${integrationId}`);
    }
    return structuredClone(this.fixture.analytics.platform_by_integration[integrationId] ?? []);
  }
}

function validateFixture(input: unknown): FakePostizFixture {
  const fixture = asRecord(input);
  if (
    !fixture ||
    fixture.schema !== FAKE_POSTIZ_FIXTURE_SCHEMA ||
    fixture.mode !== 'inert' ||
    typeof fixture.connected !== 'boolean' ||
    !Array.isArray(fixture.integrations) ||
    !Array.isArray(fixture.posts)
  ) {
    throw fixtureError(
      'fake fixture requires schema, inert mode, connection state, integrations, and posts'
    );
  }
  const analytics = asRecord(fixture.analytics);
  if (
    !analytics ||
    !asRecord(analytics.post_by_integration) ||
    !asRecord(analytics.platform_by_integration)
  ) {
    throw fixtureError('fake fixture requires post and platform analytics maps');
  }
  return structuredClone(input) as FakePostizFixture;
}

function validateDays(days: number): void {
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    throw fixtureError('analytics days must be an integer from 1 to 365');
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isIsoDate(value: string): boolean {
  return value.trim() !== '' && !Number.isNaN(Date.parse(value));
}

function fixtureError(message: string): PostizError {
  return new PostizError({ category: 'validation', code: 'FAKE_POSTIZ_FIXTURE', message });
}
