/** Server-only Postiz adapter types. Do not export this module through browser contracts. */

export type PostizPlatformIdentifier = 'instagram' | 'instagram-standalone' | 'youtube' | string;

export interface PostizHealth {
  connected: boolean;
}

export interface PostizIntegration {
  id: string;
  name: string;
  identifier: PostizPlatformIdentifier;
  disabled: boolean;
  profile: string | null;
}

export interface PostizMediaReference {
  artifact_asset_id: string;
  id: string;
  path: string;
}

export interface PostizContentValue {
  content: string;
  image: Array<{ id: string; path: string }>;
}

export interface PostizInstagramSettings {
  __type: 'instagram' | 'instagram-standalone';
  post_type: 'reel';
  is_trial_reel: false;
  collaborators: [];
}

export interface PostizYoutubeSettings {
  __type: 'youtube';
  title: string;
  type: 'public' | 'unlisted' | 'private';
  selfDeclaredMadeForKids: 'no';
  thumbnail: null;
  tags: Array<{ value: string; label: string }>;
}

export interface PostizCreatePayload {
  type: 'draft' | 'schedule' | 'now';
  date: string;
  shortLink: false;
  tags: [];
  posts: Array<{
    integration: { id: string };
    value: PostizContentValue[];
    settings: PostizInstagramSettings | PostizYoutubeSettings;
  }>;
}

export interface PostizCreateReceipt {
  postId: string;
  integration: string;
}

export interface PostizPostRecord {
  id: string;
  publishDate: string;
  releaseURL: string | null;
  releaseId: string | null;
  state: string | null;
  integration: {
    id: string;
    providerIdentifier: string;
    name: string;
  };
}

export interface PostizAnalyticsPoint {
  total: string;
  date: string;
}

export interface PostizAnalyticsMetric {
  label: string;
  data: PostizAnalyticsPoint[];
  percentageChange: number | null;
}

export interface PostizGateway {
  health(): Promise<PostizHealth>;
  listIntegrations(): Promise<PostizIntegration[]>;
  createPost(payload: PostizCreatePayload): Promise<PostizCreateReceipt[]>;
  listPosts(query: { startDate: string; endDate: string }): Promise<PostizPostRecord[]>;
  changePostStatus(
    postId: string,
    status: 'draft' | 'schedule'
  ): Promise<{
    id: string;
    state: 'DRAFT' | 'QUEUE';
  }>;
  getPostAnalytics(postId: string, days: number): Promise<PostizAnalyticsMetric[]>;
  getPlatformAnalytics(integrationId: string, days: number): Promise<PostizAnalyticsMetric[]>;
}
