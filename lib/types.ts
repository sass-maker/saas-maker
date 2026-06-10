export interface HistoryPoint {
  ts: number; // unix timestamp ms
  dr: number;
}

export interface TrackedDomain {
  domain: string; // normalized, e.g. "google.com"
  history: HistoryPoint[];
  lastChecked: number | null; // timestamp of last successful fetch
  isCustom?: boolean; // true for sites the user explicitly added (these get weekly auto-refresh)
}

export interface StoredState {
  version: 1 | 2;
  domains: TrackedDomain[];
  lastGlobalRefresh: number | null;
  // New in v2 for weekly auto "cron"
  autoRefreshEnabled?: boolean;
  lastAutoRefresh?: number | null;
}

export type SortMode =
  | 'dr-desc'
  | 'dr-asc'
  | 'name-asc'
  | 'name-desc'
  | 'updated-desc'
  | 'updated-asc'
  | 'trend-desc';

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface Prediction {
  domain: string;
  note?: string;
  addedAt: number; // when the user submitted the prediction
}
