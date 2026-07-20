import { hostnameFromUrl, shouldFetchDomainRating } from './domain.js';
import type { HistoryDB } from './db.js';

const AHREFS_ENDPOINT = 'https://api.ahrefs.com/v3/public/domain-rating-free';
export const DOMAIN_RATING_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface DomainRatingResult {
  domain: string;
  rating: number;
  fetchedAt: number;
}

/** Stored record. rating === null is a negative-cache sentinel: Ahrefs has no rating. */
export interface StoredDomainRating {
  domain: string;
  rating: number | null;
  fetchedAt: number;
}

interface AhrefsApiResponse {
  domain_rating?: { domain_rating?: number };
  error?: string;
}

const memoryCache = new Map<string, StoredDomainRating>();

function cacheKey(domain: string): string {
  return domain.toLowerCase();
}

function readMemoryCache(domain: string): StoredDomainRating | null {
  const hit = memoryCache.get(cacheKey(domain));
  if (!hit) return null;
  if (Date.now() - hit.fetchedAt > DOMAIN_RATING_TTL_MS) {
    memoryCache.delete(cacheKey(domain));
    return null;
  }
  return hit;
}

function writeMemoryCache(record: StoredDomainRating): StoredDomainRating {
  memoryCache.set(cacheKey(record.domain), record);
  return record;
}

function readStored(db: HistoryDB | undefined, domain: string): StoredDomainRating | null {
  if (!db) return null;
  const stored = db.getDomainRating(domain);
  if (!stored) return null;
  if (Date.now() - stored.fetchedAt > DOMAIN_RATING_TTL_MS) return null;
  return writeMemoryCache(stored);
}

function persist(db: HistoryDB | undefined, record: StoredDomainRating): StoredDomainRating {
  writeMemoryCache(record);
  db?.upsertDomainRating(record);
  return record;
}

/**
 * Fetch Ahrefs Domain Rating (free public endpoint, no API key).
 * Returns null when the target is ineligible (CF platform host, localhost, etc.)
 * or when Ahrefs has no rating.
 */
export async function fetchDomainRating(
  target: string,
  opts: { force?: boolean; db?: HistoryDB } = {},
): Promise<DomainRatingResult | null> {
  if (!shouldFetchDomainRating(target)) return null;

  const domain = hostnameFromUrl(target);
  if (!domain) return null;

  if (!opts.force) {
    const cached = readMemoryCache(domain) ?? readStored(opts.db, domain);
    // A fresh sentinel (rating null) means "Ahrefs has no rating" — don't refetch.
    if (cached) return cached.rating === null ? null : { domain: cached.domain, rating: cached.rating, fetchedAt: cached.fetchedAt };
  }

  const res = await fetch(
    `${AHREFS_ENDPOINT}?target=${encodeURIComponent(domain)}&output=json`,
    {
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; psi-swarm/0.2; +https://github.com/sarthakagrawal927/psi-swarm)',
      },
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Ahrefs HTTP ${res.status}: ${txt.slice(0, 200)}`);
  }

  const data = (await res.json()) as AhrefsApiResponse;
  const fetchedAt = Date.now();
  const rating = data.error ? undefined : data.domain_rating?.domain_rating;
  if (typeof rating !== 'number' || !Number.isFinite(rating)) {
    // Negative-cache "no rating" so the scheduler doesn't refetch on every probe.
    persist(opts.db, { domain, rating: null, fetchedAt });
    return null;
  }

  persist(opts.db, { domain, rating, fetchedAt });
  return { domain, rating, fetchedAt };
}

export interface FetchDomainRatingsResult {
  ratings: Map<string, DomainRatingResult>;
  /** Domains where a lookup completed — a rating or a no-rating sentinel was recorded. */
  resolved: number;
}

/** Batch-fetch DR for multiple origins with modest concurrency. */
export async function fetchDomainRatings(
  targets: string[],
  opts: { concurrency?: number; force?: boolean; db?: HistoryDB } = {},
): Promise<FetchDomainRatingsResult> {
  const concurrency = opts.concurrency ?? 4;
  const eligible = [...new Set(
    targets
      .map((t) => hostnameFromUrl(t))
      .filter((d): d is string => !!d && shouldFetchDomainRating(`https://${d}/`)),
  )];

  const out = new Map<string, DomainRatingResult>();
  let resolved = 0;
  let idx = 0;

  async function worker(): Promise<void> {
    while (idx < eligible.length) {
      const domain = eligible[idx++];
      try {
        const result = await fetchDomainRating(`https://${domain}/`, {
          force: opts.force,
          db: opts.db,
        });
        // No throw = rating or no-rating sentinel recorded (domains are pre-filtered eligible).
        resolved += 1;
        if (result) out.set(domain, result);
      } catch {
        /* skip individual failures — dashboard still renders perf data */
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, eligible.length) }, () => worker()));
  return { ratings: out, resolved };
}

/**
 * Read stored ratings for dashboard display (includes stale entries and
 * no-rating sentinels — callers must treat rating null as "no rating").
 */
export function domainRatingsForOrigins(
  origins: string[],
  db: HistoryDB,
): Map<string, StoredDomainRating> {
  const stored = db.domainRatings();
  const out = new Map<string, StoredDomainRating>();
  for (const origin of origins) {
    const host = hostnameFromUrl(origin);
    if (!host) continue;
    const hit = stored.get(host.toLowerCase());
    if (hit) out.set(host, hit);
  }
  return out;
}
