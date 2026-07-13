export const POSTIZ_FIXTURE_SCHEMA = 'fleet.postiz-contract-fixture.v1';

export class PostizContractFixtureAdapter {
  constructor(fixture) {
    this.fixture = validateFixture(fixture);
    this.calls = [];
    this.capabilities = Object.freeze({
      provider: 'postiz-fixture',
      channels: Object.freeze([...new Set(this.fixture.integrations.map((entry) => entry.channel))]),
      fixtureOnly: true,
    });
  }

  async post(input) {
    const integration = this.fixture.integrations.find((entry) =>
      entry.brand === input?.project_slug && entry.channel === input.channel && entry.accountSlug === input.account_slug);
    if (!integration) throw new PostizFixtureError(`no fixture integration for ${input?.project_slug}/${input?.channel}/${input?.account_slug}`);
    assertMedia(input);
    const request = Object.freeze({
      brand: input.project_slug,
      channel: input.channel,
      accountSlug: input.account_slug,
      integrationId: integration.integrationId,
      scheduledFor: input.scheduled_for ?? null,
      media: input.channel === 'youtube_shorts' ? input.local_path : input.result_url,
      settings: input.channel === 'youtube_shorts'
        ? Object.freeze({ title: input.title, privacyStatus: 'private' })
        : Object.freeze({ caption: input.body, shareToFeed: true }),
    });
    this.calls.push(request);
    const response = this.fixture.responses.find((entry) => entry.integrationId === integration.integrationId && entry.channel === input.channel);
    if (!response) throw new PostizFixtureError(`no fixture response for ${integration.integrationId}/${input.channel}`);
    return Object.freeze({
      provider: 'postiz-fixture',
      status: input.scheduled_for ? 'scheduled' : response.status,
      externalId: response.externalId,
      externalUrl: response.externalUrl ?? null,
    });
  }

  async metrics(externalId) {
    const response = this.fixture.responses.find((entry) => entry.externalId === externalId);
    if (!response) throw new PostizFixtureError(`no metrics fixture for ${externalId}`);
    return Object.freeze({
      provider: 'postiz-fixture', externalId, recordedAt: response.metrics.recordedAt,
      metrics: Object.freeze(structuredClone(response.metrics.values)),
    });
  }
}

function validateFixture(input) {
  if (input?.schema !== POSTIZ_FIXTURE_SCHEMA || input.mode !== 'fixture' || !Array.isArray(input.integrations) || !Array.isArray(input.responses)) {
    throw new PostizFixtureError('fixture schema, fixture mode, integrations, and responses are required');
  }
  const keys = new Set();
  for (const entry of input.integrations) {
    if (!entry?.brand || !entry.channel || !entry.accountSlug || !entry.integrationId) throw new PostizFixtureError('complete fixture integration mapping is required');
    const key = `${entry.brand}:${entry.channel}:${entry.accountSlug}`;
    if (keys.has(key)) throw new PostizFixtureError(`duplicate fixture integration: ${key}`);
    keys.add(key);
  }
  for (const response of input.responses) {
    if (!response?.integrationId || !response.channel || !response.status || !response.externalId || !response.metrics?.recordedAt || !response.metrics?.values) {
      throw new PostizFixtureError('complete fixture response and metrics are required');
    }
  }
  return structuredClone(input);
}

function assertMedia(input) {
  if (input.channel === 'instagram_reels' && !/^https:\/\//.test(input.result_url ?? '')) {
    throw new PostizFixtureError('Instagram fixture requires a public HTTPS media URL');
  }
  if (input.channel === 'youtube_shorts' && !input.local_path) {
    throw new PostizFixtureError('YouTube fixture requires a local media path');
  }
}

export class PostizFixtureError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PostizFixtureError';
    this.code = 'POSTIZ_FIXTURE_CONTRACT';
  }
}
