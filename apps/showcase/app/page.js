const DOCS_URL = 'https://docs.sassmaker.com';
const GITHUB_URL = 'https://github.com/sarthak-fleet/saas-maker';
const OWNER_URL = 'https://github.com/sarthakagrawal927';
const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'https://app.sassmaker.com';

// Each project carries its own color identity. Sized hints drive bento layout.
const CORE = [
  {
    n: '001', name: 'Foundry', initials: 'Fd', tag: 'Operating layer',
    desc: 'The open-source factory floor running underneath every other project on this page. Registry, feedback, changelog, tasks, audits, widgets — one cockpit, one API, one CLI.',
    color: '#e07b3a', size: 'feature', href: GITHUB_URL,
  },
  {
    n: '002', name: 'CodeVetter', initials: 'Cv', tag: 'Desktop · core',
    desc: 'AI code review platform. Desktop-first, works offline.',
    color: '#10b981', size: 'tall', href: 'https://github.com/sarthak-fleet/CodeVetter',
  },
  {
    n: '003', name: 'Reel Pipeline', initials: 'Rp', tag: 'Automation · core',
    desc: 'AI reel generation and autopost orchestration for fleet marketing.',
    color: '#c026d3', size: 'tall', href: 'https://github.com/sarthak-fleet/reel-pipeline',
  },
  {
    n: '004', name: 'High Signal', initials: 'Hs', tag: 'Editorial · core',
    desc: 'A public signal log for AI infrastructure and semiconductors.',
    color: '#84cc16', size: 'wide', href: 'https://github.com/sarthak-fleet/high-signal',
  },
  {
    n: '005', name: 'AI Game', initials: 'Ag', tag: 'Simulation · core',
    desc: 'A persistent AI world simulator — interactive, multi-agent, RPG-shaped.',
    color: '#8b5cf6', size: 'std', href: 'https://github.com/sarthakagrawal927/ai-game',
  },
  {
    n: '006', name: 'TinyGPT', initials: 'Tg', tag: 'Research · core',
    desc: 'A small language model, built from the ground up.',
    color: '#06b6d4', size: 'std', href: 'https://github.com/sarthak-fleet/tinygpt',
  },
  {
    n: '007', name: 'RolePatch', initials: 'Rt', tag: 'AI · core',
    desc: 'AI-powered resume tailoring for a specific role and a specific story.',
    color: '#f43f5e', size: 'wide', href: 'https://github.com/sarthak-fleet/resume-tailor',
  },
];

const ACTIVE = [
  { name: 'free-ai', desc: 'OpenAI-compatible gateway for free LLM providers.', color: '#fbbf24', href: 'https://github.com/sarthak-fleet/free-ai' },
  { name: 'truehire', desc: 'AI-powered candidate vetting platform.', color: '#6366f1', href: 'https://github.com/sarthak-fleet/truehire' },
  { name: 'starboard', desc: 'AI-built project management dashboard.', color: '#14b8a6', href: 'https://github.com/sarthak-fleet/starboard' },
  { name: 'reader', desc: 'Web annotator for documents and articles.', color: '#94a3b8', href: 'https://github.com/sarthak-fleet/reader' },
  { name: 'email-manager', desc: 'Unified email management and automation.', color: '#3b82f6', href: 'https://github.com/sarthak-fleet/email-manager' },
  { name: 'open-historia', desc: 'Interactive historical timeline platform.', color: '#f97316', href: 'https://github.com/sarthak-fleet/open-historia' },
  { name: 'everythingrated', desc: 'Ratings and reviews — for everything.', color: '#ef4444', href: 'https://github.com/sarthak-fleet/everythingrated' },
  { name: 'looptv', desc: 'TV-like app for curated YouTube channels.', color: '#a855f7', href: 'https://github.com/sarthak-fleet/looptv' },
  { name: 'anime_list', desc: 'MAL explorer for anime and manga lists.', color: '#ec4899', href: 'https://github.com/sarthak-fleet/anime_list' },
  { name: 'linkchat', desc: 'Real-time chat, built with Next.js.', color: '#0ea5e9', href: 'https://github.com/sarthak-fleet/linkchat' },
  { name: 'today-little-log', desc: 'Daily logging and micro-journaling.', color: '#a8a29e', href: 'https://github.com/sarthak-fleet/today-little-log' },
  { name: 'swe-interview-prep', desc: 'Interview prep tooling for engineers.', color: '#22c55e', href: 'https://github.com/sarthak-fleet/swe-interview-prep' },
  { name: 'significanthobbies', desc: 'Personal hobby mapping and journey visualizer.', color: '#f472b6', href: 'https://github.com/sarthak-fleet/significanthobbies' },
];

const TICKER = [...CORE.map(p => p.name), ...ACTIVE.map(p => p.name)];

const SPEC = [
  ['Operator', 'Sarthak Agrawal'],
  ['Runtime', 'Cloudflare Workers · D1 · KV · R2'],
  ['Interfaces', 'REST · CLI · TypeScript SDK · Widgets'],
  ['Primitives', 'registry · feedback · changelog · tasks · audits · waitlist'],
  ['Origin', '2024 →'],
  ['License', 'MIT'],
  ['Source', 'github.com/sarthak-fleet/saas-maker'],
];

export default function LandingPage() {
  return (
    <>
      <div className="grain" aria-hidden="true" />
      <div className="aurora" aria-hidden="true">
        <span className="aurora-blob aurora-blob-1" />
        <span className="aurora-blob aurora-blob-2" />
        <span className="aurora-blob aurora-blob-3" />
      </div>

      <nav className="nav">
        <a href="/" className="brand">
          <span className="brand-mark">
            <span className="brand-mark-glyph">F</span>
          </span>
          <span className="brand-stack">
            <span className="brand-name">Foundry</span>
            <span className="brand-meta">Est. <em>MMXXIV</em> · sarthak</span>
          </span>
        </a>
        <div className="nav-links">
          <a href="#fleet">The Fleet</a>
          <a href="#spec">Specification</a>
          <a href={DOCS_URL} target="_blank" rel="noopener noreferrer">Manual</a>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">Source</a>
        </div>
        <div className="nav-actions">
          <a href={DASHBOARD_URL} className="btn btn-primary">Cockpit →</a>
        </div>
      </nav>

      <header className="hero">
        <div className="hero-grid" aria-hidden="true" />
        <div className="hero-meta hero-anim" style={{ '--delay': '0ms' }}>
          <span className="status-dot" />
          <span>fleet ledger</span>
          <span className="hero-meta-sep">/</span>
          <span className="hero-meta-issue">Vol. 01</span>
          <span className="hero-meta-sep">/</span>
          <span>{new Date().getFullYear()}</span>
        </div>

        <h1 className="hero-title">
          <span className="hero-line hero-anim" style={{ '--delay': '80ms' }}>
            A small,
          </span>
          <span className="hero-line hero-anim" style={{ '--delay': '160ms' }}>
            <em className="italic">working</em> fleet of
          </span>
          <span className="hero-line hero-anim" style={{ '--delay': '240ms' }}>
            twenty <em className="italic">curious</em> products,
          </span>
          <span className="hero-line hero-anim" style={{ '--delay': '320ms' }}>
            forged by <span className="copper">one builder</span>.
          </span>
        </h1>

        <p className="hero-sub hero-anim" style={{ '--delay': '440ms' }}>
          This is the dossier of everything I&apos;ve built and kept running — desktop apps, AI experiments,
          live services — plus <em className="italic">Foundry</em>, the open-source operating layer that holds them together.
        </p>

        <div className="hero-actions hero-anim" style={{ '--delay': '520ms' }}>
          <a href="#fleet" className="btn btn-primary btn-lg">Open the catalog</a>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-lg">
            <span>Foundry source</span>
            <span className="btn-arrow">↗</span>
          </a>
        </div>

        <dl className="hero-numerals hero-anim" style={{ '--delay': '640ms' }}>
          <div>
            <dt>Products</dt>
            <dd><span className="numeral">20</span></dd>
          </div>
          <div>
            <dt>Operators</dt>
            <dd>
              <span className="numeral">1</span>
              <span className="numeral-dim"> + agents</span>
            </dd>
          </div>
          <div>
            <dt>Origin</dt>
            <dd><span className="numeral">MMXXIV</span></dd>
          </div>
          <div>
            <dt>License</dt>
            <dd><span className="numeral">MIT</span></dd>
          </div>
        </dl>
      </header>

      <div className="ticker" aria-hidden="true">
        <div className="ticker-track">
          {[...TICKER, ...TICKER, ...TICKER].map((name, i) => (
            <span key={i} className="ticker-item">
              <span className="ticker-bullet">◆</span>
              {name}
            </span>
          ))}
        </div>
      </div>

      <section className="section" id="fleet">
        <div className="section-head">
          <div className="section-marker">
            <span className="section-num">§ 01</span>
            <span className="section-rule" />
            <span className="section-kw">The Fleet</span>
          </div>
          <h2 className="section-title">
            Twenty <em className="italic">distinct</em> products,
            <br />
            one shared <em className="italic">operating layer</em>.
          </h2>
          <p className="section-lede">
            No mockups. No fake screenshots. Each card below is a real repository,
            color-coded by its place in the fleet, ordered by how much I&apos;m still actively shipping it.
          </p>
        </div>

        <div className="bento">
          {CORE.map((p, i) => (
            <a
              key={p.n}
              href={p.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`card card-${p.size}`}
              style={{
                '--accent': p.color,
                '--delay': `${i * 70}ms`,
              }}
            >
              <div className="card-cover">
                <span className="card-cover-glow" />
                <span className="card-cover-grid" />
                <span className="card-monogram">{p.initials}</span>
              </div>
              <div className="card-body">
                <div className="card-meta">
                  <span className="card-num">№ {p.n}</span>
                  <span className="card-tag">{p.tag}</span>
                </div>
                <h3 className="card-title">{p.name}</h3>
                <p className="card-desc">{p.desc}</p>
                <span className="card-cta">
                  <span>View repository</span>
                  <span className="card-arrow">→</span>
                </span>
              </div>
            </a>
          ))}
        </div>

        <div className="active">
          <div className="active-head">
            <span className="section-num">§ 01.02</span>
            <span className="section-rule short" />
            <span className="section-kw small">Also running</span>
            <span className="active-count">{ACTIVE.length} more</span>
          </div>
          <ul className="active-grid">
            {ACTIVE.map(p => (
              <li key={p.name}>
                <a
                  href={p.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mini"
                  style={{ '--accent': p.color }}
                >
                  <span className="mini-dot" />
                  <span className="mini-name">{p.name}</span>
                  <span className="mini-desc">{p.desc}</span>
                  <span className="mini-arrow">↗</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section" id="spec">
        <div className="section-head">
          <div className="section-marker">
            <span className="section-num">§ 02</span>
            <span className="section-rule" />
            <span className="section-kw">The Foundry</span>
          </div>
          <h2 className="section-title">
            One <em className="italic">backend</em>
            <br />
            for the entire <em className="italic">workshop</em>.
          </h2>
          <p className="section-lede">
            Every project on this page hits the same API. Same registry, same feedback boards,
            same changelog, same task queue. New product, day one: it&apos;s already integrated.
          </p>
        </div>

        <div className="spec-layout">
          <dl className="spec-sheet">
            <div className="spec-head">
              <span className="spec-stamp">SPECIFICATION</span>
              <span className="spec-rule" />
            </div>
            {SPEC.map(([k, v]) => (
              <div key={k} className="spec-row">
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
            <div className="spec-foot">
              <span className="spec-rule" />
              <span className="spec-stamp">END · FOLIO 01</span>
            </div>
          </dl>

          <div className="terminal">
            <div className="terminal-head">
              <span className="t-dot t-r" />
              <span className="t-dot t-y" />
              <span className="t-dot t-g" />
              <span className="terminal-title">~/fleet — fnd CLI</span>
            </div>
            <pre className="terminal-body">
{`$ npm i -g @saas-maker/cli
$ fnd login
   ✓ authenticated as @sarthakagrawal927

$ fnd projects list
   001  Foundry          core   operating layer
   002  CodeVetter       core   desktop-first AI review
   003  Reel Pipeline    core   marketing automation
   004  High Signal      core   editorial signal log
   005  AI Game          core   multi-agent simulator
   ... 15 more

$ fnd api POST /v1/feedback \\
    --body '{"project":"high-signal","title":"add RSS"}'
   → feedback #142 created`}
            </pre>
          </div>
        </div>
      </section>

      <section className="cta">
        <div className="cta-card">
          <div className="cta-grid" aria-hidden="true" />
          <span className="cta-stamp">An invitation</span>
          <h2 className="cta-title">
            Take the operating layer.
            <br />
            <em className="italic">Or just read the source.</em>
          </h2>
          <p className="cta-lede">
            The whole thing is open. Fork it, deploy it on your own Cloudflare account,
            or just look at how one person runs twenty things.
          </p>
          <div className="cta-actions">
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-lg">
              <span>GitHub</span>
              <span className="btn-arrow">↗</span>
            </a>
            <a href={DOCS_URL} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-lg">
              Read the manual
            </a>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="footer-brand">
          <span className="brand-mark sm">
            <span className="brand-mark-glyph">F</span>
          </span>
          <span>Foundry · a personal fleet by <a href={OWNER_URL} target="_blank" rel="noopener noreferrer">Sarthak Agrawal</a></span>
        </div>
        <div className="footer-links">
          <a href={DOCS_URL} target="_blank" rel="noopener noreferrer">Manual</a>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">Source</a>
          <a href={OWNER_URL} target="_blank" rel="noopener noreferrer">@sarthakagrawal927</a>
        </div>
        <span className="footer-copy">
          <span className="footer-sigil">F</span>
          MMXXIV — present · MIT
        </span>
      </footer>
    </>
  );
}
