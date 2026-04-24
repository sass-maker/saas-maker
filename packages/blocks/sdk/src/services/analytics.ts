import { HttpClient } from '../http';

// ---- Types ----

export interface TrackEventData {
  name?: string;
  url?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  screen_width?: number;
  properties?: Record<string, unknown>;
}

export interface TrackEventResponse {
  ok: true;
}

// ---- Service ----

export class AnalyticsService {
  constructor(private http: HttpClient) {}

  /** Track an analytics event (POST /v1/analytics/events). */
  track(data: TrackEventData = {}): Promise<TrackEventResponse> {
    return this.http.request<TrackEventResponse>('POST', '/v1/analytics/events', data);
  }
}
