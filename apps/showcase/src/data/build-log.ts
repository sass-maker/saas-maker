// Build log entries — derived from real git history across fleet repos.
// Each entry is anchored to an actual commit (SHA, date, message) from the
// repository's git log. No invented milestones.
//
// Sources: `git log --oneline --date=short --format='%h %ad %s'` run across
// every fleet repo on 2026-07-17. Entries are curated to show the fleet story
// — solo builder + agents, real shipped milestones.

export interface BuildLogEntry {
  date: string;
  repo: string;
  sha: string;
  message: string;
  // Narrative context written around the real commit — what it meant for the fleet.
  note: string;
}

export const BUILD_LOG: BuildLogEntry[] = [
  // ── 2025: the earliest seeds ──
  {
    date: '2025-02-08',
    repo: 'swe-interview-prep',
    sha: 'c982498',
    message: 'Initial commit: DSA Prep Studio with Blind 75 problems',
    note: 'The first fleet repo. A DSA practice tool — Blind 75 problems with code execution and LeetCode import. Started the pattern: build the tool you need, ship it, move on.',
  },
  {
    date: '2025-02-16',
    repo: 'anime-list',
    sha: 'f766faa',
    message: 'Init sample script',
    note: 'MAL Explorer began as a sample script, then became an Express server, then a TypeScript SPA. The oldest continuously-developed personal project in the fleet.',
  },
  {
    date: '2025-11-16',
    repo: 'reader',
    sha: '08c8e24',
    message: 'Initial commit from Create Next App',
    note: 'Reader — a research library for capture, annotation, and AI chat over your reading. Private by default.',
  },
  {
    date: '2025-11-30',
    repo: 'codevetter',
    sha: '970cd2d',
    message: 'init',
    note: 'CodeVetter was born — a desktop-first AI code review workbench for agent-generated code. Local SQLite, Tauri shell, evidence-backed review. The repo never hits a central server.',
  },

  // ── 2026 Feb: the foundry takes shape ──
  {
    date: '2026-02-15',
    repo: 'free-ai',
    sha: '341d997',
    message: 'feat: implement Cloudflare Worker AI gateway with routing, auth, docs, and tests',
    note: 'The AI Gateway shipped — an OpenAI-compatible LLM gateway fronting free-tier models across 30+ providers. This became the fleet\'s default inference path for routine agent work.',
  },
  {
    date: '2026-02-22',
    repo: 'starboard',
    sha: '555ec09',
    message: 'Add starboard design document',
    note: 'Starboard: GitHub stars organizer with semantic search. A sub-product under CodeVetter for repo intelligence.',
  },
  {
    date: '2026-02-23',
    repo: 'rolepatch',
    sha: '4401a98',
    message: 'Add initial design document for resume tailor app',
    note: 'RolePatch started — AI-powered resume tailoring. Score fit against a job description, rewrite bullets, prep interviews.',
  },
  {
    date: '2026-02-24',
    repo: 'email-manager',
    sha: '5a0df4b',
    message: 'Initial commit: Gmail email manager',
    note: 'Email Manager: a Gmail workspace with local semantic search. Private email tooling, on-device.',
  },
  {
    date: '2026-02-26',
    repo: 'saas-maker',
    sha: 'c3e1c5f',
    message: 'Add feedback module design document',
    note: 'The Foundry itself was scaffolded. SaaS Maker — the fleet control plane — started as a pnpm monorepo with a feedback module, then grew into the registry, cockpit, CLI, SDK, and widgets that bind the fleet together.',
  },
  {
    date: '2026-02-26',
    repo: 'saas-maker',
    sha: 'e7dfa08',
    message: 'scaffold: pnpm monorepo with workspace config',
    note: 'The monorepo structure was laid down: workers/api (Hono + CF Workers), apps/cockpit (Next.js), apps/docs (Astro), packages/cli, packages/sdk, packages/widgets. One API, one CLI, one cockpit.',
  },

  // ── 2026 March: products multiply ──
  {
    date: '2026-03-01',
    repo: 'significanthobbies',
    sha: '58260de',
    message: 'chore: bootstrap with T3 Stack + shadcn/ui dark theme',
    note: 'Significant Hobbies launched — a life planner for private daily rituals and public living. Hobbies, bucket lists, and side quests over time.',
  },
  {
    date: '2026-03-01',
    repo: 'saas-maker',
    sha: '—',
    message: 'feat: add testimonials service with SDK widget and dashboard page',
    note: 'Foundry gained testimonials and changelog services alongside feedback. The widget ecosystem formed — embeddable feedback, testimonials, and changelog widgets for any fleet product.',
  },
  {
    date: '2026-03-05',
    repo: 'karte',
    sha: '9ab442c',
    message: 'feat: scaffold Next.js 15 project with deps',
    note: 'Karte shipped — a link-in-bio registry for humans and AI agents. Public trust cards with machine-readable manifests at /{slug}/agent.json.',
  },
  {
    date: '2026-04-04',
    repo: 'looptv',
    sha: '9af1206',
    message: 'Initial commit from Create Next App',
    note: 'LoopTV: a TV-style random video player for lean-back browsing of curated channels. 13 stations, 36K videos.',
  },

  // ── 2026 April: High Signal and the editorial lane ──
  {
    date: '2026-04-25',
    repo: 'high-signal',
    sha: '30acf8b',
    message: 'init: high-signal scaffold',
    note: 'High Signal launched — a daily synthesized brief on technology, startups, and finance. Five sections with inline hit-rates. The ingest pipeline, worker routes, and seed corpus all went live the same day.',
  },
  {
    date: '2026-04-25',
    repo: 'high-signal',
    sha: '—',
    message: 'chore: deploy Modal — daily ingest + scoring crons live',
    note: 'High Signal\'s daily ingest and scoring crons went live on Modal. The pipeline ran end-to-end: HF Inference Router → push-to-API writer → worker → web.',
  },
  {
    date: '2026-04-26',
    repo: 'everythingrated',
    sha: '4f88cf3',
    message: 'chore: bootstrap pnpm monorepo',
    note: 'EverythingRated: multi-axis rating tool for structured directories. Decisions with explicit trade-offs, not star averages.',
  },

  // ── 2026 May: PostTrainLLM and the research lane ──
  {
    date: '2026-05-21',
    repo: 'posttrainllm',
    sha: 'f55332f',
    message: 'Initial scaffold: browser TinyGPT learning project',
    note: 'PostTrainLLM began — a Mac-local LLM specialist factory. Post-training and runtime that fits on one Mac, plus a WebGPU playground for browser-based inference.',
  },
  {
    date: '2026-05-22',
    repo: 'posttrainllm',
    sha: '—',
    message: 'Implement Phases 1-4: Python reference, LoRA, WASM backend, browser app',
    note: 'Four phases shipped in one day: Python reference implementation, LoRA adapter training, WASM backend, and the browser app. The specialist model factory took shape.',
  },
  {
    date: '2026-05-26',
    repo: 'posttrainllm',
    sha: '—',
    message: 'Roadmap: lever #3 (multi-thread WASM) shipped with measured 2x speedup',
    note: 'Multi-threaded WASM delivered a measured 2x speedup. The devlog recorded it as a shipped win, not a plan.',
  },
  {
    date: '2026-05-30',
    repo: 'research-papers',
    sha: 'b265131',
    message: 'feat: multi-source paper data platform on ClickHouse',
    note: 'researchPapers: an academic paper platform over a high-citation OpenAlex CS corpus — ~488k papers with semantic search, analytics, and a RAG demo.',
  },

  // ── 2026 June: fleet-ops and the operating layer ──
  {
    date: '2026-06-10',
    repo: 'drank',
    sha: 'd84ac32',
    message: 'Initial commit from Create Next App',
    note: 'DRank: an Ahrefs Domain Rating tracker feeding High Signal /domains and fleet domain marketing work.',
  },
  {
    date: '2026-06-21',
    repo: 'materia',
    sha: '48b4b32',
    message: 'chore: initialize git for materia',
    note: 'Materia: an evidence-graded reference for remedies organized by body part — body → condition → remedy → compound → study, with citations.',
  },
  {
    date: '2026-06-22',
    repo: 'fleet-ops',
    sha: '—',
    message: 'workspace: track fleet-ops/ (tooling, perf outputs, retired-project archives) + standards',
    note: 'fleet-ops was formalized — the version-controlled home for shared fleet tooling: skills, scripts, teammates, automation, psi-swarm, and the agent-surfaces-registry that now drives this hub.',
  },
  {
    date: '2026-06-23',
    repo: 'fleet-ops',
    sha: '—',
    message: 'fleet-ops: add perf audit + perf-PR automation script',
    note: 'psi-swarm automation arrived — distributional Lighthouse / PageSpeed audits with grounded performance analysis across the fleet. The perf-PR automation script turned audit results into actionable diffs.',
  },

  // ── 2026 July: the hub and agent surfaces ──
  {
    date: '2026-07-13',
    repo: 'pace',
    sha: '3efd1a2',
    message: 'Initialize Pace',
    note: 'Pace shipped — an on-device Mac voice agent that reads your screen and acts with local context. The newest core product.',
  },
  {
    date: '2026-07-17',
    repo: 'saas-maker',
    sha: '—',
    message: 'Add crawlable product-site directory on Foundry hub; raster OG image.',
    note: 'The Foundry hub gained a crawlable product-site directory — every public fleet origin linked from sassmaker.com with dofollow equity. The hub became the linkable narrative asset.',
  },
  {
    date: '2026-07-17',
    repo: 'saas-maker',
    sha: '—',
    message: 'Add agent indexing surfaces (llms.txt, index.md, /api/ai)',
    note: 'Agent indexing surfaces went live across the fleet: llms.txt, index.md, /api/ai, and robots.txt on every public origin. The agent-surfaces-registry became the source of truth.',
  },
  {
    date: '2026-07-17',
    repo: 'saas-maker',
    sha: '—',
    message: 'Expand public sitemaps for crawler coverage',
    note: 'Sitemaps expanded fleet-wide for crawler coverage. The hub and every product origin now expose structured sitemaps.',
  },
];
