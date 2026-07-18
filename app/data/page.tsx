import type { Metadata } from 'next';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const dynamic = 'force-static';

const siteUrl = 'https://domains.sassmaker.com';

type HistoryPoint = { ts: number; dr: number };
type GlobalDrFile = {
  lastUpdated: string;
  domains: Record<string, { history: HistoryPoint[] }>;
  communityNominations?: Array<{ domain: string; note: string; nominatedAt: number }>;
};

function loadGlobalDr(): GlobalDrFile {
  const path = join(process.cwd(), 'data/global-dr.json');
  return JSON.parse(readFileSync(path, 'utf8')) as GlobalDrFile;
}

function getWeeklyChange(
  history: HistoryPoint[]
): { delta: number; direction: 'up' | 'down' | 'flat'; latest: number; previous: number } | null {
  if (history.length < 2) return null;
  const sorted = [...history].sort((a, b) => a.ts - b.ts);
  const latest = sorted[sorted.length - 1];
  const weekAgo = latest.ts - 7 * 24 * 60 * 60 * 1000;
  let base: HistoryPoint | null = null;
  for (let i = sorted.length - 2; i >= 0; i--) {
    if (sorted[i].ts <= weekAgo + 2 * 24 * 60 * 60 * 1000) {
      base = sorted[i];
      break;
    }
  }
  if (!base) base = sorted[0];
  const delta = Number((latest.dr - base.dr).toFixed(1));
  return {
    delta,
    direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
    latest: latest.dr,
    previous: base.dr,
  };
}

function formatDate(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

export const metadata: Metadata = {
  title: 'drank · Public DR Dataset & Weekly Movers',
  description:
    'Downloadable Ahrefs Domain Rating history for 45+ popular sites plus the fleet domain set. Weekly DR movers table, raw JSON, and Dataset metadata.',
  alternates: { canonical: '/data' },
  openGraph: {
    title: 'drank · Public DR Dataset & Weekly Movers',
    description:
      'Downloadable Ahrefs Domain Rating history for 45+ popular sites. Weekly DR movers table and raw JSON.',
    url: `${siteUrl}/data`,
    type: 'website',
  },
};

export default function DataPage() {
  const data = loadGlobalDr();
  const domainEntries = Object.entries(data.domains);

  const movers = domainEntries
    .map(([domain, { history }]) => {
      const change = getWeeklyChange(history);
      if (!change) return null;
      return { domain, ...change, history };
    })
    .filter(Boolean) as Array<{
    domain: string;
    delta: number;
    direction: 'up' | 'down' | 'flat';
    latest: number;
    previous: number;
    history: HistoryPoint[];
  }>;

  const gainers = movers.filter((m) => m.direction === 'up').sort((a, b) => b.delta - a.delta);

  const losers = movers.filter((m) => m.direction === 'down').sort((a, b) => a.delta - b.delta);

  const allSorted = [...movers].sort((a, b) => b.latest - a.latest);
  const totalDomains = domainEntries.length;
  const totalSnapshots = domainEntries.reduce((sum, [, d]) => sum + d.history.length, 0);
  const nominations = data.communityNominations ?? [];

  const datasetJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'drank Global Domain Rating History',
    description:
      'Weekly Ahrefs Domain Rating (DR) snapshots for 45+ popular websites plus the SaaS Maker fleet domain set. Updated weekly via GitHub Actions.',
    url: `${siteUrl}/data`,
    distribution: [
      {
        '@type': 'DataDownload',
        encodingFormat: 'application/json',
        contentUrl: `${siteUrl}/data/global-dr.json`,
      },
    ],
    creator: {
      '@type': 'Organization',
      name: 'SaaS Maker (Foundry)',
      url: 'https://sassmaker.com',
    },
    license: 'https://creativecommons.org/licenses/by/4.0/',
    isAccessibleForFree: true,
    keywords: ['domain rating', 'ahrefs', 'DR', 'SEO', 'domain authority'],
    dateModified: data.lastUpdated,
  };

  return (
    <div className="bg-zinc-950 text-zinc-200 min-h-screen">
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static JSON-LD
        dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetJsonLd) }}
      />
      <div className="mx-auto max-w-5xl px-6 py-12">
        <nav className="mb-8 text-sm text-zinc-400">
          <a href="/" className="hover:text-zinc-200 underline">
            drank
          </a>{' '}
          / <span className="text-zinc-200">data</span>
        </nav>

        <h1 className="text-4xl font-semibold tracking-tight text-white mb-3">Public DR Dataset</h1>
        <p className="text-zinc-400 max-w-2xl mb-8">
          Weekly Ahrefs Domain Rating snapshots for {totalDomains} popular websites plus the SaaS
          Maker fleet domain set. The raw JSON is updated every Monday ~04:00 UTC via a GitHub
          Action and mirrored here for download.
        </p>

        <div className="grid grid-cols-3 gap-4 mb-10">
          <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
            <div className="text-2xl font-bold text-white">{totalDomains}</div>
            <div className="text-sm text-zinc-400">Tracked domains</div>
          </div>
          <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
            <div className="text-2xl font-bold text-white">{totalSnapshots}</div>
            <div className="text-sm text-zinc-400">Total DR snapshots</div>
          </div>
          <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
            <div className="text-2xl font-bold text-white">
              {formatDate(new Date(data.lastUpdated).getTime())}
            </div>
            <div className="text-sm text-zinc-400">Last updated</div>
          </div>
        </div>

        <div className="mb-10 flex gap-3">
          <a
            href="/data/global-dr.json"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
            download
          >
            Download global-dr.json
          </a>
          <a
            href="/data/fleet-dr.json"
            className="inline-flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-4 py-2 rounded-lg text-sm font-medium transition border border-zinc-700"
            download
          >
            Download fleet-dr.json
          </a>
        </div>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-1">Weekly DR Movers</h2>
          <p className="text-zinc-400 text-sm mb-6">
            Change between the latest snapshot and the one ~7 days prior. Most established domains
            are stable week-over-week; movers reflect recent backlink shifts.
          </p>

          {gainers.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-medium text-green-400 mb-3">Gainers</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-zinc-800 rounded-lg overflow-hidden">
                  <thead className="bg-zinc-900 text-zinc-400">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Domain</th>
                      <th className="text-right px-4 py-2 font-medium">Previous DR</th>
                      <th className="text-right px-4 py-2 font-medium">Latest DR</th>
                      <th className="text-right px-4 py-2 font-medium">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gainers.map((m) => (
                      <tr key={m.domain} className="border-t border-zinc-800">
                        <td className="px-4 py-2 text-zinc-200">{m.domain}</td>
                        <td className="px-4 py-2 text-right text-zinc-400">{m.previous}</td>
                        <td className="px-4 py-2 text-right text-white font-medium">{m.latest}</td>
                        <td className="px-4 py-2 text-right text-green-400 font-medium">
                          +{m.delta}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {losers.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-medium text-red-400 mb-3">Losers</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-zinc-800 rounded-lg overflow-hidden">
                  <thead className="bg-zinc-900 text-zinc-400">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Domain</th>
                      <th className="text-right px-4 py-2 font-medium">Previous DR</th>
                      <th className="text-right px-4 py-2 font-medium">Latest DR</th>
                      <th className="text-right px-4 py-2 font-medium">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {losers.map((m) => (
                      <tr key={m.domain} className="border-t border-zinc-800">
                        <td className="px-4 py-2 text-zinc-200">{m.domain}</td>
                        <td className="px-4 py-2 text-right text-zinc-400">{m.previous}</td>
                        <td className="px-4 py-2 text-right text-white font-medium">{m.latest}</td>
                        <td className="px-4 py-2 text-right text-red-400 font-medium">{m.delta}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {gainers.length === 0 && losers.length === 0 && (
            <p className="text-zinc-500 text-sm">
              No domains changed DR in the latest weekly window — all tracked sites are stable.
            </p>
          )}
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-1">Full Domain Rating Table</h2>
          <p className="text-zinc-400 text-sm mb-6">
            All {totalDomains} tracked domains sorted by latest DR. Each row links to the
            interactive tracker where you can view full history and sparklines.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-zinc-800 rounded-lg overflow-hidden">
              <thead className="bg-zinc-900 text-zinc-400">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Domain</th>
                  <th className="text-right px-4 py-2 font-medium">Latest DR</th>
                  <th className="text-right px-4 py-2 font-medium">Weekly Change</th>
                  <th className="text-right px-4 py-2 font-medium">Snapshots</th>
                </tr>
              </thead>
              <tbody>
                {allSorted.map((m) => (
                  <tr key={m.domain} className="border-t border-zinc-800 hover:bg-zinc-900">
                    <td className="px-4 py-2">
                      <a
                        href={`/?domain=${encodeURIComponent(m.domain)}`}
                        className="text-zinc-200 hover:text-blue-400 underline"
                      >
                        {m.domain}
                      </a>
                    </td>
                    <td className="px-4 py-2 text-right text-white font-medium">{m.latest}</td>
                    <td className="px-4 py-2 text-right">
                      {m.direction === 'up' && <span className="text-green-400">+{m.delta}</span>}
                      {m.direction === 'down' && <span className="text-red-400">{m.delta}</span>}
                      {m.direction === 'flat' && <span className="text-zinc-500">—</span>}
                    </td>
                    <td className="px-4 py-2 text-right text-zinc-500">{m.history.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {nominations.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-white mb-1">Community Nominations</h2>
            <p className="text-zinc-400 text-sm mb-6">
              Domains nominated by the community for future tracking.
            </p>
            <ul className="space-y-2">
              {nominations.map((n) => (
                <li key={n.domain} className="bg-zinc-900 rounded-lg p-3 border border-zinc-800">
                  <span className="text-zinc-200 font-medium">{n.domain}</span>
                  <span className="text-zinc-500 ml-3">— {n.note}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="text-sm text-zinc-500 border-t border-zinc-800 pt-6">
          <h2 className="text-lg font-medium text-zinc-300 mb-2">Data Provenance</h2>
          <p>
            DR values are fetched from Ahrefs' free public Domain Rating API via a weekly GitHub
            Action (<code className="text-zinc-400">scripts/update-global-dr.mjs</code>). The fleet
            subset covers SaaS Maker product domains. Data is licensed CC-BY 4.0. The interactive
            tracker at{' '}
            <a href="/" className="underline hover:text-zinc-300">
              drank home
            </a>{' '}
            lets you add your own domains and track them locally in your browser.
          </p>
        </section>
      </div>
    </div>
  );
}
