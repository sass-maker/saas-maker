'use client';
import { useEffect, useRef } from 'react';

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'https://app.sassmaker.com';
const DOCS_URL = 'https://docs.sassmaker.com';
const GITHUB_URL = 'https://github.com/sarthakagrawal927/saas-maker';

function useFadeIn() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add('visible'); obs.disconnect(); } },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

function WaitlistMockup() {
  return (
    <div className="feature-row-mock">
      <div className="wl-header">
        <span className="wl-title">waitlist.sassmaker.com/acme</span>
        <span className="wl-badge">● Live</span>
      </div>
      <div className="wl-body">
        <div className="wl-counter">
          <div className="wl-count">2,847</div>
          <div className="wl-count-label">people on the waitlist</div>
        </div>
        <div className="wl-form">
          <div className="wl-input">you@company.com</div>
          <div className="wl-submit">Join Waitlist</div>
        </div>
        <div className="wl-recent">
          <div className="wl-recent-label">Recent sign-ups</div>
          {[
            { initials: 'JK', color: '#3b82f6', email: 'james.k@startup.io', time: '2m ago' },
            { initials: 'SR', color: '#7c3aed', email: 'sarah.r@acme.com', time: '8m ago' },
            { initials: 'ML', color: '#22c55e', email: 'm.lee@techco.dev', time: '14m ago' },
          ].map(u => (
            <div key={u.email} className="wl-recent-row">
              <div className="wl-avatar" style={{ background: u.color }}>{u.initials}</div>
              <div className="wl-email">{u.email}</div>
              <div className="wl-time">{u.time}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TestimonialsMockup() {
  // Illustrative UI preview of the testimonials widget — not real customer
  // quotes. Content is intentionally generic placeholder copy describing how
  // the widget renders, so the mockup never reads as a fabricated endorsement.
  return (
    <div className="feature-row-mock">
      <div className="wl-header">
        <span className="wl-title">testimonials — widget preview</span>
        <span className="testi-embed-tag" style={{ margin: 0 }}>{'</> embed'}</span>
      </div>
      <div className="mock-body">
        {[
          {
            stars: '★★★★★',
            text: 'Approved customer testimonials render here, collected through your shareable form or the API.',
            name: 'Customer name', role: 'Role · Company', color: '#3b82f6', initials: '◆', delay: '0s',
          },
          {
            stars: '★★★★★',
            text: 'Each card shows the rating, quote, and an optional verified badge once you approve it.',
            name: 'Customer name', role: 'Role · Company', color: '#7c3aed', initials: '◆', delay: '0.15s',
          },
          {
            stars: '★★★★★',
            text: 'Drop the one-line embed on any site — the widget stays in sync with the cockpit.',
            name: 'Customer name', role: 'Role · Company', color: '#22c55e', initials: '◆', delay: '0.3s',
          },
        ].map((t, i) => (
          <div key={i} className="testi-card" style={{ animationDelay: t.delay }}>
            <div className="testi-stars">{t.stars}</div>
            <div className="testi-text">{t.text}</div>
            <div className="testi-author">
              <div className="testi-avatar" style={{ background: t.color }}>{t.initials}</div>
              <div>
                <div className="testi-name">{t.name}</div>
                <div className="testi-role">{t.role}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FeedbackMockup() {
  const items = [
    { votes: 142, title: 'Dark mode support', desc: 'Add a dark theme option to the dashboard', tag: 'planned', tagLabel: 'Planned', active: true },
    { votes: 98, title: 'CSV export for feedback', desc: 'Let us download all feedback as a spreadsheet', tag: 'in-progress', tagLabel: 'In Progress', active: false },
    { votes: 73, title: 'Slack notifications', desc: 'Notify our team when new feedback arrives', tag: 'completed', tagLabel: 'Completed', active: false },
  ];
  return (
    <div className="feature-row-mock">
      <div className="wl-header">
        <span className="wl-title">Feature Requests — 23 open</span>
        <span className="wl-badge" style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.3)' }}>Voting Open</span>
      </div>
      <div className="mock-body">
        {items.map(item => (
          <div key={item.title} className="fb-item">
            <div className="fb-vote">
              <div className={`fb-vote-btn ${item.active ? 'active' : ''}`}>▲</div>
              <div className="fb-vote-count">{item.votes}</div>
            </div>
            <div className="fb-content">
              <div className="fb-title">{item.title}</div>
              <div className="fb-desc">{item.desc}</div>
              <span className={`fb-tag ${item.tag}`}>{item.tagLabel}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChangelogMockup() {
  const entries = [
    { version: 'v2.4.0', dot: '#3b82f6', title: 'Embeddable Changelog Widget', badge: 'feature', badgeLabel: 'Feature', desc: 'Drop a single script tag to add a live changelog popup to your product.' },
    { version: 'v2.3.1', dot: '#22c55e', title: 'Faster feedback loading', badge: 'fix', badgeLabel: 'Fix', desc: 'Resolved a slow query causing 2s+ load times on large feedback boards.' },
    { version: 'v2.3.0', dot: '#a78bfa', title: 'Roadmap view', badge: 'improvement', badgeLabel: 'Improvement', desc: 'Feedback items now show a public roadmap with status columns.' },
  ];
  return (
    <div className="feature-row-mock">
      <div className="wl-header">
        <span className="wl-title">Changelog</span>
        <span className="cl-badge feature" style={{ margin: 0, fontSize: '0.65rem' }}>Latest: v2.4.0</span>
      </div>
      <div className="mock-body">
        {entries.map((e, i) => (
          <div key={e.version} className="cl-entry">
            <div className="cl-dot-col">
              <div className="cl-dot" style={{ background: e.dot }} />
              {i < entries.length - 1 && <div className="cl-dot-line" />}
            </div>
            <div className="cl-content">
              <div className="cl-version">{e.version}</div>
              <div className="cl-title">
                {e.title}
                <span className={`cl-badge ${e.badge}`}>{e.badgeLabel}</span>
              </div>
              <div className="cl-desc">{e.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalyticsMockup() {
  const barHeights = [30, 45, 38, 60, 52, 70, 48];
  return (
    <div className="feature-row-mock">
      <div className="an-header">
        <span className="an-title">Analytics Dashboard</span>
        <span className="an-period">Last 7 days</span>
      </div>
      <div className="an-body">
        <div className="an-stats">
          {[
            { label: 'Waitlist Signups', value: '847', delta: '+12% vs last week', deltaColor: '#22c55e' },
            { label: 'Feedback Items', value: '134', delta: '+8% vs last week', deltaColor: '#22c55e' },
            { label: 'Testimonials', value: '29', delta: '+3 this week', deltaColor: '#60a5fa' },
            { label: 'Changelog Views', value: '2.1k', delta: '+24% vs last week', deltaColor: '#22c55e' },
          ].map(s => (
            <div key={s.label} className="an-stat">
              <div className="an-stat-label">{s.label}</div>
              <div className="an-stat-value">{s.value}</div>
              <div className="an-stat-delta" style={{ color: s.deltaColor }}>{s.delta}</div>
            </div>
          ))}
        </div>
        <div className="an-chart">
          <div className="an-chart-label">Daily signups</div>
          <div className="an-bars">
            {barHeights.map((h, i) => (
              <div key={i} className="an-bar" style={{ height: h, background: `rgba(59,130,246,${0.3 + (h / 70) * 0.5})` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DevCodeMockup() {
  return (
    <div className="feature-row-mock" style={{ fontFamily: 'monospace', fontSize: '0.72rem', lineHeight: 1.7 }}>
      <div className="wl-header">
        <span className="wl-title">terminal</span>
        <span className="wl-badge" style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.25)' }}>TypeScript</span>
      </div>
      <div className="mock-body" style={{ padding: '1rem' }}>
        <div style={{ color: '#6b7280', marginBottom: '0.75rem' }}># install</div>
        <div style={{ marginBottom: '1.25rem' }}>
          <span style={{ color: '#a78bfa' }}>$</span>
          <span style={{ color: '#e2e8f0' }}> npm install </span>
          <span style={{ color: '#4ade80' }}>@saas-maker/sdk</span>
        </div>
        <div style={{ color: '#6b7280', marginBottom: '0.75rem' }}># integrate in seconds</div>
        <div style={{ color: '#94a3b8' }}>
          <div><span style={{ color: '#60a5fa' }}>import</span> {'{ SaaSMakerClient }'} <span style={{ color: '#60a5fa' }}>from</span> <span style={{ color: '#4ade80' }}>'@saas-maker/sdk'</span></div>
          <div style={{ marginTop: '0.5rem' }}><span style={{ color: '#60a5fa' }}>const</span> <span style={{ color: '#e2e8f0' }}>client</span> = <span style={{ color: '#60a5fa' }}>new</span> <span style={{ color: '#fbbf24' }}>SaaSMakerClient</span>{'({'}</div>
          <div style={{ paddingLeft: '1.25rem' }}><span style={{ color: '#fca5a5' }}>apiKey</span>: <span style={{ color: '#4ade80' }}>'your-api-key'</span></div>
          <div>{'})'}</div>
          <div style={{ marginTop: '0.5rem' }}><span style={{ color: '#60a5fa' }}>await</span> client.<span style={{ color: '#fbbf24' }}>feedback</span>.<span style={{ color: '#60a5fa' }}>submit</span>{'({'}</div>
          <div style={{ paddingLeft: '1.25rem' }}><span style={{ color: '#fca5a5' }}>title</span>: <span style={{ color: '#4ade80' }}>'Dark mode'</span>,</div>
          <div style={{ paddingLeft: '1.25rem' }}><span style={{ color: '#fca5a5' }}>type</span>: <span style={{ color: '#4ade80' }}>'feature'</span>,</div>
          <div style={{ paddingLeft: '1.25rem' }}><span style={{ color: '#fca5a5' }}>description</span>: <span style={{ color: '#4ade80' }}>'Add dark theme'</span></div>
          <div>{'})'}</div>
        </div>
      </div>
    </div>
  );
}

function HeroDashMockup() {
  return (
    <div className="hero-mock">
      <div className="mock-titlebar">
        <span className="mock-dot red" />
        <span className="mock-dot yellow" />
        <span className="mock-dot green" />
        <span className="mock-title">SaaS Maker — Dashboard</span>
      </div>
      <div className="mock-body">
        <div className="dash-stat-row">
          <div className="dash-stat">
            <div className="dash-stat-label">Waitlist</div>
            <div className="dash-stat-value" style={{ color: '#3b82f6' }}>2,847</div>
            <div className="dash-stat-delta">↑ 12% this week</div>
          </div>
          <div className="dash-stat">
            <div className="dash-stat-label">Feedback</div>
            <div className="dash-stat-value" style={{ color: '#7c3aed' }}>134</div>
            <div className="dash-stat-delta">↑ 8% this week</div>
          </div>
          <div className="dash-stat">
            <div className="dash-stat-label">Testimonials</div>
            <div className="dash-stat-value" style={{ color: '#22c55e' }}>29</div>
            <div className="dash-stat-delta">↑ 3 new</div>
          </div>
        </div>
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.75rem', marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>Recent activity</div>
          {[
            { dot: '#3b82f6', name: 'james.k@startup.io', action: 'joined waitlist' },
            { dot: '#7c3aed', name: 'Dark mode support', action: 'received 5 upvotes' },
            { dot: '#22c55e', name: 'Alex Tran', action: 'left a testimonial' },
            { dot: '#f97316', name: 'v2.4.0 changelog', action: 'viewed by 142 users' },
          ].map(r => (
            <div key={r.name} className="dash-row">
              <div className="dash-row-dot" style={{ background: r.dot }} />
              <span className="dash-row-name">{r.name}</span>
              <span>{r.action}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const featuresHeaderRef = useFadeIn();
  const waitlistRef = useFadeIn();
  const testiRef = useFadeIn();
  const feedbackRef = useFadeIn();
  const changelogRef = useFadeIn();
  const analyticsRef = useFadeIn();
  const devRef = useFadeIn();
  const moreRef = useFadeIn();

  return (
    <>
      <nav className="nav">
        <div className="nav-logo">
          <div className="nav-logo-icon">F</div>
          Foundry
        </div>
        <div className="nav-links">
          <a href="#standard">The Standard</a>
          <a href="#blocks">The Blocks</a>
          <a href={DOCS_URL} target="_blank" rel="noopener noreferrer">The Manual</a>
          <a href="/made-with">Showcase</a>
        </div>
        <div className="nav-actions">
          <a href={DASHBOARD_URL} className="btn btn-ghost">Cockpit</a>
          <a href={DASHBOARD_URL} className="btn btn-primary">Join the Fleet</a>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero">
        <div>
          <div className="hero-badge">
            <span className="hero-badge-dot" />
            Fleet OS for solo builders
          </div>
          <h1>Run every product from<br /><span className="hero-highlight">one operational cockpit</span></h1>
          <p>Foundry is the API-first layer for your fleet: project metadata, feedback, changelogs, tasks, audits, widgets, and standards that stay aligned as your apps multiply.</p>
          <div className="hero-actions">
            <a href={DASHBOARD_URL} className="btn btn-primary btn-lg">Open Cockpit</a>
            <a href={DOCS_URL} className="btn btn-secondary btn-lg" target="_blank" rel="noopener noreferrer">Read Docs</a>
          </div>
          <div className="trust-bar">
            <span className="trust-label">Built for</span>
            <div className="trust-logos">
              <span className="trust-logo">Cloudflare</span>
              <span className="trust-logo">Next.js</span>
              <span className="trust-logo">Workers</span>
              <span className="trust-logo">API-first</span>
            </div>
          </div>
        </div>
        <HeroDashMockup />
      </section>

      <hr className="divider" />

      {/* Features section */}
      <section className="section" id="standard">
        <div className="section-header fade-up" ref={featuresHeaderRef}>
          <div className="section-label">Control plane</div>
          <h2>One system of record for<br /><span>every product you ship</span></h2>
          <p>Stop treating each app as a separate island. Foundry gives every project the same metadata, operational tasks, product feedback, and health checks.</p>
        </div>

        {/* The Standard */}
        <div className="feature-row fade-up" ref={waitlistRef}>
          <div className="feature-row-text">
            <div className="feature-row-title">
              <div className="feature-row-icon" style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)' }}>📏</div>
              Project Registry
            </div>
            <p className="feature-row-body">
              Keep production URLs, GitHub links, owners, limits, notes, and local guidance attached to the project instead of scattered across tabs and memory.
            </p>
            <ul className="feature-row-checks">
              <li>Fleet metadata API and cockpit dashboard</li>
              <li>Local agent guidance mirrored into repos</li>
              <li>Deployment links and health state in one place</li>
            </ul>
            <a href={DOCS_URL} className="btn btn-ghost">View Registry Docs</a>
          </div>
          <WaitlistMockup />
        </div>

        {/* Testimonials */}
        <div className="feature-row fade-up" ref={testiRef}>
          <TestimonialsMockup />
          <div className="feature-row-text">
            <div className="feature-row-title">
              <div className="feature-row-icon" style={{ background: 'rgba(250,204,21,0.1)', border: '1px solid rgba(250,204,21,0.2)' }}>⭐</div>
              Testimonials
            </div>
            <p className="feature-row-body">
              Capture proof while the product is still moving. Collect, approve, and embed testimonials without building another mini-backend.
            </p>
            <ul className="feature-row-checks">
              <li>Collect via shareable form or API</li>
              <li>Verified customer badges</li>
              <li>One-line embed for any website</li>
            </ul>
            <a href={DASHBOARD_URL} className="btn btn-ghost">See Testimonials</a>
          </div>
        </div>

        {/* Feedback & Feature Voting */}
        <div className="feature-row fade-up" ref={feedbackRef}>
          <div className="feature-row-text">
            <div className="feature-row-title">
              <div className="feature-row-icon" style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.2)' }}>💬</div>
              Feedback & Voting
            </div>
            <p className="feature-row-body">
              Turn product feedback into durable work. Users can submit issues and requests; you can promote them into tasks without losing context.
            </p>
            <ul className="feature-row-checks">
              <li>Public or private feedback boards</li>
              <li>Upvoting, status labels & roadmap view</li>
              <li>Notify voters when items ship</li>
            </ul>
            <a href={DASHBOARD_URL} className="btn btn-ghost">Explore Feedback</a>
          </div>
          <FeedbackMockup />
        </div>

        {/* Changelog */}
        <div className="feature-row fade-up" ref={changelogRef}>
          <ChangelogMockup />
          <div className="feature-row-text">
            <div className="feature-row-title">
              <div className="feature-row-icon" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>📡</div>
              Changelog
            </div>
            <p className="feature-row-body">
              Publish visible progress from the same place you track the work. Ship updates to your app, docs, and widgets without rebuilding a changelog system per project.
            </p>
            <ul className="feature-row-checks">
              <li>In-app widget with unread badge</li>
              <li>Auto-notify subscribed users</li>
              <li>Version tags, categories & search</li>
            </ul>
            <a href={DASHBOARD_URL} className="btn btn-ghost">See Changelog</a>
          </div>
        </div>

        {/* Analytics */}
        <div className="feature-row fade-up" ref={analyticsRef}>
          <div className="feature-row-text">
            <div className="feature-row-title">
              <div className="feature-row-icon" style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)' }}>📊</div>
              Analytics
            </div>
            <p className="feature-row-body">
              See which projects are alive, deployed, failing, or drifting. Fleet audits, smoke checks, and performance snapshots turn maintenance into a routine.
            </p>
            <ul className="feature-row-checks">
              <li>Unified dashboard across all features</li>
              <li>Trend charts and week-over-week comparisons</li>
              <li>Export data to CSV or connect via API</li>
            </ul>
            <a href={DASHBOARD_URL} className="btn btn-ghost">View Analytics</a>
          </div>
          <AnalyticsMockup />
        </div>

        {/* Developer / SDK */}
        <div className="feature-row fade-up" ref={devRef}>
          <DevCodeMockup />
          <div className="feature-row-text">
            <div className="feature-row-title">
              <div className="feature-row-icon" style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}>⚡</div>
              Built for developers
            </div>
            <p className="feature-row-body">
              Every surface is available through REST, CLI, or SDK. Agents and scripts can inspect, update, and comment on the same records the cockpit shows.
            </p>
            <ul className="feature-row-checks">
              <li>TypeScript SDK with full type coverage</li>
              <li>REST API — use any language or framework</li>
              <li>Runs on Cloudflare Workers — deployed at the edge</li>
            </ul>
            <a href={DOCS_URL} className="btn btn-ghost" target="_blank" rel="noopener noreferrer">Read the Docs</a>
          </div>
        </div>
      </section>

      <hr className="divider" />

      {/* More features grid */}
      <section className="section" id="blocks">
        <div className="section-header fade-up" ref={moreRef}>
          <div className="section-label">Building blocks</div>
          <h2>Composable services for<br /><span>shipping faster without drift</span></h2>
          <p>Use the blocks independently or as a fleet-wide operating system. Everything is designed to be scriptable, auditable, and easy for agents to operate.</p>
        </div>
        <div className="feature-grid">
          {[
            { icon: '🤖', bg: 'rgba(249,115,22,0.1)', title: 'Free AI gateway', body: 'Route routine AI work through free/local providers first, with paid escalation kept explicit.' },
            { icon: '📊', bg: 'rgba(59,130,246,0.12)', title: 'Fleet audits', body: 'GitHub, deployment, auth, smoke, and performance checks on a repeatable cadence.' },
            { icon: '📦', bg: 'rgba(124,58,237,0.1)', title: 'Project metadata', body: 'README, rate limits, guidance, links, and ownership stored behind one API.' },
            { icon: '📡', bg: 'rgba(34,197,94,0.1)', title: 'Widgets', body: 'Feedback, changelog, testimonials, badge, analytics, and progress widgets.' },
            { icon: '⚡', bg: 'rgba(250,204,21,0.08)', title: 'Symphony tasks', body: 'Durable tasks with comments, blockers, PR/deploy state, and agent handoff history.' },
            { icon: '🌐', bg: 'rgba(59,130,246,0.08)', title: 'Cloudflare core', body: 'Workers API, D1, Wrangler automation, and deploy-aware smoke checks.' },
          ].map(f => (
            <div key={f.title} className="feature-card">
              <div className="feature-icon" style={{ background: f.bg }}>{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div className="nav-logo-icon" style={{ width: 22, height: 22, fontSize: '0.55rem' }}>F</div>
          <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Foundry</span>
        </div>
        <span className="footer-copy">© 2026 The Foundry. Open source under MIT.</span>
        <div className="footer-links">
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">GitHub</a>
          <a href={DOCS_URL} target="_blank" rel="noopener noreferrer">The Manual</a>
          <a href="/made-with">Showcase</a>
        </div>
      </footer>
    </>
  );
}
