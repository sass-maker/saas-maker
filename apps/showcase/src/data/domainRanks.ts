// Domain Rating snapshot — imported from the archived drank app's checked-in
// fleet-dr.json. Provider-reported Ahrefs DR history; null readings stay null.
import domainRanksData from './domain-ranks.json';
import domainRanksSites from './domain-ranks-sites.json';

export type DrReading = { ts: number; dr: number | null };

export type DomainRank = {
  domain: string;
  tracked: boolean;
  current: number | null;
  previous: number | null;
  delta: number | null;
  firstSeen: number;
  lastSeen: number;
  readings: number;
};

type RawRankFile = {
  lastUpdated: string;
  domains: Record<string, { history: { ts: number; dr: number | null }[] }>;
};

const raw = domainRanksData as RawRankFile;
const trackedSites = new Set(domainRanksSites as string[]);

export const RANKS_UPDATED = raw.lastUpdated;

export const DOMAIN_RANKS: DomainRank[] = Object.entries(raw.domains)
  .map(([domain, entry]) => {
    const history = [...entry.history].sort((a, b) => b.ts - a.ts);
    const current = history[0]?.dr ?? null;
    const previous = history.find((r) => r.dr !== current)?.dr ?? null;
    return {
      domain,
      tracked: trackedSites.has(domain),
      current,
      previous,
      delta: current !== null && previous !== null ? current - previous : null,
      firstSeen: history[history.length - 1]?.ts ?? 0,
      lastSeen: history[0]?.ts ?? 0,
      readings: history.length,
    };
  })
  .sort((a, b) => (b.current ?? -1) - (a.current ?? -1) || a.domain.localeCompare(b.domain));
