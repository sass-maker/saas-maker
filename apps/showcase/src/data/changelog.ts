export interface ChangelogEntry {
  date: string;
  label: string;
  title: string;
  summary: string;
  changes: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: '2026-09-26',
    label: 'September 26, 2026',
    title: 'Public domain-rank board and the drank skill',
    summary:
      "The archived drank tracker's DR history became a public board at /ranks, and drank itself joined the capability register as a credential-free skill.",
    changes: [
      'Imported the checked-in fleet DR snapshot — 29 owned domains with weekly Ahrefs DR history — into src/data/domain-ranks.json.',
      'Added /ranks, /ranks.json, and /ranks.md: ranked table with per-domain deltas, provenance, and an explicit not-reported-vs-zero rule.',
      'Added tooling/skills/drank so DR lookup is a cataloged agent skill alongside psi-swarm; the tooling register now lists 100 capabilities.',
      'Linked the board from the footer, sitemap, llms.txt, and /api/ai.',
    ],
  },
  {
    date: '2026-09-26',
    label: 'September 26, 2026',
    title: 'Every catalog entry became a page',
    summary:
      'Each launch destination, funding program, idea, and tool now has its own indexable URL in the sitemap.',
    changes: [
      'Extended /launchdesk/<domain> from playbooked rows to every active destination — 845 catalog records with verbatim source claims.',
      'Added /ideas/<slug> pages for all 48 public scored ideas with full reasoning.',
      'Added /tools/<id> pages for all 99 reusable capabilities, linking back to their canonical source.',
      'Registered all entity pages in sitemap.xml and cross-linked every index row to its detail page.',
    ],
  },
  {
    date: '2026-09-26',
    label: 'September 26, 2026',
    title: 'The funding workspace moved onto the site',
    summary:
      'The Funding & Accelerators workspace became a native public directory — no more living inside Notion.',
    changes: [
      'Imported all 184 programs into a checked-in dataset rendered at /funding, one row per specific program.',
      'Reproduced the workspace’s sixteen decision views as public presets with their original filters and ordering.',
      'Gave every program a full record page and JSON twin at /funding/<slug> and /funding/<slug>.json.',
      'Published the strategy, application materials, methodology, and archive documents alongside the directory.',
      'Kept uncertainty visible: evidence quality, website status, and unresolved rows are shown rather than smoothed away.',
    ],
  },
  {
    date: '2026-09-26',
    label: 'September 26, 2026',
    title: 'The spotlight became a product ledger',
    summary: 'The homepage hero stopped pretending the workshop wall has four panes.',
    changes: [
      'Replaced the half-empty featured-pane grid with a ruled ledger of full-width product plaques.',
      'Gave each spotlight product a persistent tone marker so the pane-color story works on touch, not only hover.',
      'Kept the steel frame, limestone ground, Schibsted type, and the atelier photograph as a masked edge glimpse.',
    ],
  },
  {
    date: '2026-09-26',
    label: 'September 26, 2026',
    title: 'LaunchDesk research passed four hundred playbooks',
    summary:
      'The launch catalog gained another hundred researched destinations in descending authority order.',
    changes: [
      'Added over a hundred researched playbooks covering submission routes, requirements, and honest unknowns.',
      'Quarantined dead or gated destinations instead of keeping optimistic claims.',
      'Re-measured 898 active destinations with the live verification sweep.',
    ],
  },
  {
    date: '2026-09-25',
    label: 'September 25, 2026',
    title: 'Launch playbooks became an executable toolkit',
    summary:
      'LaunchDesk grew into a working kit: a per-product coverage ledger and hundreds of researched destination playbooks.',
    changes: [
      'Published the free agent-executable launch toolkit at /launchkit.',
      'Added a per-project launch coverage ledger so submissions map back to products.',
      'Grew the playbook library past three hundred researched destinations.',
    ],
  },
  {
    date: '2026-09-23',
    label: 'September 23, 2026',
    title: 'The directory started measuring visits',
    summary:
      'Watchtower browser telemetry now records public page usage so the surface can be evaluated on evidence.',
    changes: ['Added Watchtower browser telemetry to the public pages.'],
  },
  {
    date: '2026-09-20',
    label: 'September 20, 2026',
    title: 'Learnings became an editorial series',
    summary:
      'Eleven first-party articles now document how the launch catalog is researched, verified, and maintained.',
    changes: [
      'Published eleven LaunchDesk articles covering catalog research, data quality, quarantine, and submission practice.',
      'Wired every article into the markdown and agent-readable surfaces automatically.',
    ],
  },
  {
    date: '2026-09-18',
    label: 'September 18, 2026',
    title: 'LaunchDesk moved onto the workshop',
    summary:
      'The launch-destination catalog left private tooling and became a public page at /launchdesk.',
    changes: [
      'Rendered the thousand-destination catalog natively with authority, link-policy, and pricing columns.',
      'Kept source claims, quarantine state, and unknown-vs-zero semantics visible instead of smoothed over.',
    ],
  },
  {
    date: '2026-09-10',
    label: 'September 10, 2026',
    title: 'Product profiles became generated',
    summary:
      'The public catalog is now projected from the private source catalog rather than edited by hand.',
    changes: [
      'Exposed the shared public catalog and generated the profile project data from it.',
      'Revalidated the reviewed portfolio categories and directory rows.',
    ],
  },
  {
    date: '2026-09-06',
    label: 'September 6, 2026',
    title: 'The site hardened its plumbing',
    summary:
      'Every public route now answers HEAD requests correctly, and the display typeface is self-hosted.',
    changes: [
      'Added HEAD parity on every public route.',
      'Self-hosted the Schibsted Grotesk webfont.',
    ],
  },
  {
    date: '2026-08-26',
    label: 'August 26, 2026',
    title: 'Profiles gained depth and the workshop an identity',
    summary:
      'Project pages expanded into fuller profiles, and the studio identity became its own page.',
    changes: [
      'Published expanded project profiles and a dedicated studio identity page.',
      'Added repository issue readers so product roadmaps live with the code.',
      'Corrected AI provider symbols across the public surface.',
    ],
  },
  {
    date: '2026-08-23',
    label: 'August 23, 2026',
    title: 'Ideas and tools joined the public workshop',
    summary:
      'The separate ideas surface was absorbed into /ideas, and shared tooling became a public catalog at /tools.',
    changes: [
      'Moved the scored ideas catalog onto /ideas inside the workshop theme.',
      'Published the tools catalog of shared skills, scripts, and workflows.',
      'Unified the interior pages under one steel-and-limestone system.',
    ],
  },
  {
    date: '2026-08-22',
    label: 'August 22, 2026',
    title: 'The directory opened to every project — and to agents',
    summary:
      'All Fleet projects became browsable at /projects, and the site started answering machine readers in their own formats.',
    changes: [
      'Published the complete Fleet project directory while keeping the homepage curated.',
      'Added markdown content negotiation, an OpenAPI surface, and llms endpoints for agent readers.',
      'Distilled repeated project anatomy and fixed the shared workshop frame.',
    ],
  },
  {
    date: '2026-08-10',
    label: 'August 10, 2026',
    title: 'Tokens spent for the world became a public ledger',
    summary:
      'SaaS Maker now publishes verified aggregate model usage from its products as a cumulative studio measure.',
    changes: [
      'Seeded the ledger with CodeVetter’s authoritative lifetime and latest-day token records.',
      'Added a procedural Three.js globe, exact UTC recency, and privacy-safe regional pulse support.',
      'Kept the verified metrics readable with reduced motion, no script, or unavailable WebGL.',
    ],
  },
  {
    date: '2026-07-29',
    label: 'July 29, 2026',
    title: 'Product history moved onto the products',
    summary:
      'SaaS Maker now treats each maintained product website as the owner of its public release history.',
    changes: [
      'Added this product-owned changelog to SaaS Maker.',
      'Changed directory changelog links to open the product website instead of raw commit history.',
      'Changed roadmap links to open GitHub Issues for public repositories.',
    ],
  },
  {
    date: '2026-07-29',
    label: 'July 29, 2026',
    title: 'The directory became a workshop',
    summary:
      'The public directory and product detail pages moved into one architectural workshop system.',
    changes: [
      'Rebuilt product discovery as a responsive steel-and-glass product wall.',
      'Brought internal product detail pages into the same visual language.',
      'Expanded the maintained public directory while keeping private Fleet controls out.',
    ],
  },
  {
    date: '2026-07-24',
    label: 'July 24, 2026',
    title: 'SaaS Maker became a focused public directory',
    summary:
      'The separate SaaS Maker runtime was retired in favor of a smaller static public product surface.',
    changes: [
      'Removed the abandoned dashboard, API, authentication, and internal control-panel features.',
      'Kept the public directory on sassmaker.com and the private Fleet console separate.',
      'Removed services and storage SaaS Maker no longer needed without changing product domains.',
    ],
  },
  {
    date: '2026-07-23',
    label: 'July 23, 2026',
    title: 'Feedback became a backend-free package',
    summary:
      'The maintained feedback capability was narrowed to a small React package that products control.',
    changes: [
      'Removed SaaS Maker-owned submission, inbox, authentication, and storage services.',
      'Let each integrating product decide how feedback is submitted and stored.',
    ],
  },
];
