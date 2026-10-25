export interface Target {
  url: string;
  name?: string;
  extractor?: "page" | "jobs" | "json" | "text";
  transport?: "http" | "auto" | "browser";
  company?: string;
  careersUrl?: string;
  jobUrlIncludes?: string[];
}
export interface CollectionResult {
  sourceUrl?: string;
  finalUrl?: string;
  fetchedAt: string;
  checkedAt?: string;
  status: number;
  transport: "http" | "browser";
  cacheStatus: string;
  elapsedMs: number;
  data?: unknown;
  text?: string;
  jobs?: unknown[];
  jobCount?: number;
}
export interface CollectorOptions {
  cacheFile?: string;
  concurrency?: number;
  timeoutMs?: number;
  retries?: number;
  maxResponseBytes?: number;
  userAgent?: string;
  browserFallback?: boolean;
  chromeExecutable?: string;
  profileDir?: string;
  /** Optional consumer policy, called before every HTTP request and redirect. */
  validateUrl?: (url: string) => void | Promise<void>;
}
export declare class UpstreamBlockedError extends Error {
  code: "upstream_blocked";
  status: number;
  constructor(status: number);
}
export declare function createCollector(options?: CollectorOptions): {
  collect(target: Target): Promise<CollectionResult>;
  collectMany(targets: Target[]): Promise<Array<
    { status: "completed"; target: Target; result: CollectionResult } |
    { status: "error"; target: Target; error: { code: string; message: string; status: number | null } }
  >>;
  close(): Promise<void>;
};
