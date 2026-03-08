import { HttpClient } from '../http';

// ---- Types ----

export interface WaitlistSignupData {
  email: string;
  name?: string;
}

export interface WaitlistSignupResponse {
  id: string;
  email: string;
  name: string | null;
  position: number;
  created_at: string;
}

export interface WaitlistCountResponse {
  count: number;
}

// ---- Service ----

export class WaitlistService {
  constructor(private http: HttpClient) {}

  /** Join the waitlist (POST /v1/waitlist). */
  join(data: WaitlistSignupData): Promise<WaitlistSignupResponse> {
    return this.http.request<WaitlistSignupResponse>('POST', '/v1/waitlist', data);
  }

  /** Get waitlist count (GET /v1/waitlist/count). */
  getCount(): Promise<WaitlistCountResponse> {
    return this.http.request<WaitlistCountResponse>('GET', '/v1/waitlist/count');
  }
}
