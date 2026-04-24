import { HttpClient } from '../http';

export interface DirectoryListing {
  id: string;
  name: string;
  tagline: string;
  url: string;
  description: string | null;
  logo_url: string | null;
  screenshot_url: string | null;
  twitter_url: string | null;
  project_id: string | null;
  badge_verified: boolean;
  status: string;
  tags: string[];
  created_at: string;
}

export interface DirectoryListResponse {
  data: DirectoryListing[];
  total: number;
  page: number;
  limit: number;
}

export interface DirectoryListOptions {
  page?: number;
  tag?: string;
  search?: string;
}

export interface SubmitDirectoryListingData {
  name: string;
  tagline: string;
  url: string;
  description?: string;
  logo_url?: string;
  screenshot_url?: string;
  twitter_url?: string;
  tags?: string[];
}

export interface BadgeVerifyResponse {
  verified: boolean;
  listing_id: string;
}

export class DirectoryService {
  constructor(private http: HttpClient) {}

  /** List approved directory listings (GET /v1/directory). */
  list(options?: DirectoryListOptions): Promise<DirectoryListResponse> {
    const params = new URLSearchParams();
    if (options?.page) params.set('page', String(options.page));
    if (options?.tag) params.set('tag', options.tag);
    if (options?.search) params.set('search', options.search);
    const qs = params.toString();
    return this.http.request<DirectoryListResponse>('GET', `/v1/directory${qs ? `?${qs}` : ''}`);
  }

  /** Submit a listing for review (POST /v1/directory). No auth required. */
  submit(data: SubmitDirectoryListingData): Promise<DirectoryListing> {
    return this.http.request<DirectoryListing>('POST', '/v1/directory', data);
  }

  /** Claim a listing linked to your project (POST /v1/directory/claim). Requires API key. */
  claim(data: SubmitDirectoryListingData): Promise<DirectoryListing> {
    return this.http.request<DirectoryListing>('POST', '/v1/directory/claim', data);
  }

  /** Verify the badge is present on your site (POST /v1/directory/verify-badge). Requires API key. */
  verifyBadge(): Promise<BadgeVerifyResponse> {
    return this.http.request<BadgeVerifyResponse>('POST', '/v1/directory/verify-badge');
  }
}
