import launchdeskData from './launchdesk.json';

type PlaybookSource = { url: string; title?: string };
export type Playbook = {
  domain: string;
  name: string;
  grade: 'researched' | 'observed';
  retrieved: string;
  sources: PlaybookSource[];
  category?: string;
  zeroCostRoute: 'free' | 'conditional' | 'paid' | 'unknown';
  conditions?: string[];
  requirements: string[];
  preparation: string[];
  workflow: string[];
  watchFor: string[];
  countsAsLive: string;
  unknowns: string[];
};

type Claim = {
  source: string | null;
  dr: number | null;
  link: string | null;
  pricing: string | null;
  type?: string | null;
};
export type Destination = {
  name: string;
  domain: string;
  website: string;
  submissionUrl: string | null;
  exampleUrl: string | null;
  category: string;
  type: string | null;
  pricing: string;
  dr: number | null;
  link: string;
  eligibility: string | null;
  flags: string[];
  route: string;
  provider: string | null;
  sourceUrl: string | null;
  retrieved: string | null;
  measured: string | null;
  quarantined: boolean;
  claims: Claim[];
};

export function launchdeskRecords() {
  const modules = import.meta.glob('./launchdesk-playbooks/*.json', { eager: true });
  const playbooks = new Map<string, Playbook>();
  for (const mod of Object.values(modules)) {
    const playbook = (mod as { default?: Playbook }).default ?? (mod as Playbook);
    if (playbook?.domain) playbooks.set(playbook.domain, playbook);
  }

  // One page per unique domain; rows sharing a domain merge their claims.
  const byDomain = new Map<string, Destination>();
  for (const row of launchdeskData.destinations as Destination[]) {
    if (row.quarantined || !row.domain) continue;
    const existing = byDomain.get(row.domain);
    if (!existing) {
      byDomain.set(row.domain, { ...row, claims: [...row.claims] });
    } else {
      existing.claims.push(...row.claims);
      if (existing.dr == null && row.dr != null) existing.dr = row.dr;
      if (!existing.submissionUrl && row.submissionUrl) existing.submissionUrl = row.submissionUrl;
    }
  }

  const paths: {
    params: { domain: string };
    props: { playbook: Playbook | null; destination: Destination | null };
  }[] = [...byDomain.values()].map((destination) => ({
    params: { domain: destination.domain },
    props: { playbook: playbooks.get(destination.domain) ?? null, destination },
  }));
  const covered = new Set(byDomain.keys());
  for (const playbook of playbooks.values()) {
    if (covered.has(playbook.domain)) continue;
    paths.push({ params: { domain: playbook.domain }, props: { playbook, destination: null } });
  }
  return paths;
}
