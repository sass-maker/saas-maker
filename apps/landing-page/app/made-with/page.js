'use client';
import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.sassmaker.com';
const DIRECTORY_URL = `${API_BASE}/v1/directory`;

const TAGS = ['analytics', 'devtools', 'productivity', 'saas', 'ai', 'marketing', 'finance', 'design'];

function ProductCard({ listing }) {
  const initial = listing.name.charAt(0).toUpperCase();
  return (
    <a href={listing.url} target="_blank" rel="noopener noreferrer" className="dir-card">
      <div className="dir-card-header">
        {listing.logo_url ? (
          <img src={listing.logo_url} alt={listing.name} className="dir-logo" />
        ) : (
          <div className="dir-logo-fallback">{initial}</div>
        )}
        {listing.badge_verified && (
          <span className="dir-verified" title="Badge verified">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="7" fill="#22c55e" />
              <path d="M4 7l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}
      </div>
      <div className="dir-card-body">
        <h3 className="dir-name">{listing.name}</h3>
        <p className="dir-tagline">{listing.tagline}</p>
      </div>
      {listing.tags.length > 0 && (
        <div className="dir-tags">
          {listing.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="dir-tag">{tag}</span>
          ))}
        </div>
      )}
    </a>
  );
}

function SubmitModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({ name: '', tagline: '', url: '', description: '', logo_url: '', tags: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function set(key, val) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(DIRECTORY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          tagline: form.tagline,
          url: form.url,
          description: form.description || undefined,
          logo_url: form.logo_url || undefined,
          tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="dir-modal-overlay" onClick={onClose}>
      <div className="dir-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dir-modal-header">
          <h2>Submit your product</h2>
          <button className="dir-modal-close" onClick={onClose} aria-label="Close">&#x2715;</button>
        </div>
        <p className="dir-modal-sub">Your submission will be reviewed before going live.</p>
        <form onSubmit={handleSubmit} className="dir-form">
          <label>
            Product name <span className="dir-required">*</span>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Acme" required />
          </label>
          <label>
            Tagline <span className="dir-required">*</span>
            <input value={form.tagline} onChange={(e) => set('tagline', e.target.value)} placeholder="The fastest way to ship X" required maxLength={120} />
          </label>
          <label>
            URL <span className="dir-required">*</span>
            <input type="url" value={form.url} onChange={(e) => set('url', e.target.value)} placeholder="https://acme.com" required />
          </label>
          <label>
            Logo URL <span className="dir-optional">(optional)</span>
            <input type="url" value={form.logo_url} onChange={(e) => set('logo_url', e.target.value)} placeholder="https://acme.com/logo.png" />
          </label>
          <label>
            Tags <span className="dir-optional">(comma separated, max 5)</span>
            <input value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="saas, devtools, ai" />
          </label>
          {error && <p className="dir-error">{error}</p>}
          <button type="submit" className="dir-submit-btn" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit for review'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function MadeWithPage() {
  const [listings, setListings] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [tag, setTag] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (tag) params.set('tag', tag);
    if (search) params.set('search', search);
    fetch(`${DIRECTORY_URL}?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setListings(data.data || []);
        setTotal(data.total || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, tag, search]);

  function handleSearch(e) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  }

  function selectTag(t) {
    setTag((prev) => (prev === t ? '' : t));
    setPage(1);
  }

  const totalPages = Math.ceil(total / 24);

  return (
    <>
      <nav className="nav">
        <a href="/" className="nav-logo">
          <div className="nav-logo-icon">SM</div>
          SaasMaker
        </a>
        <div className="nav-links">
          <a href="/">Home</a>
          <a href="/made-with" style={{ color: 'var(--text)' }}>Directory</a>
        </div>
        <div className="nav-actions">
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Submit product</button>
        </div>
      </nav>

      <main className="dir-main">
        <div className="dir-hero">
          <div className="hero-badge">
            <span className="hero-badge-dot" />
            Community
          </div>
          <h1>Made with <span className="hero-highlight">SaasMaker</span></h1>
          <p>Products built by indie hackers and founders using SaasMaker.</p>
          <form onSubmit={handleSearch} className="dir-search-form">
            <input
              className="dir-search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search products…"
            />
            <button type="submit" className="btn btn-primary">Search</button>
          </form>
        </div>

        <div className="dir-filters">
          {TAGS.map((t) => (
            <button
              key={t}
              className={`dir-filter-btn${tag === t ? ' active' : ''}`}
              onClick={() => selectTag(t)}
            >
              {t}
            </button>
          ))}
          {tag && (
            <button className="dir-filter-btn dir-filter-clear" onClick={() => { setTag(''); setPage(1); }}>
              &#x2715; clear
            </button>
          )}
        </div>

        {loading ? (
          <div className="dir-loading">
            {[...Array(6)].map((_, i) => <div key={i} className="dir-skeleton" />)}
          </div>
        ) : listings.length === 0 ? (
          <div className="dir-empty">
            <p>No products found.</p>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>Be the first to submit</button>
          </div>
        ) : (
          <>
            <p className="dir-count">{total} product{total !== 1 ? 's' : ''}</p>
            <div className="dir-grid">
              {listings.map((l) => <ProductCard key={l.id} listing={l} />)}
            </div>
            {totalPages > 1 && (
              <div className="dir-pagination">
                <button className="btn btn-secondary" onClick={() => setPage((p) => p - 1)} disabled={page === 1}>← Prev</button>
                <span className="dir-page-info">Page {page} of {totalPages}</span>
                <button className="btn btn-secondary" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>Next →</button>
              </div>
            )}
          </>
        )}

        <div className="dir-badge-cta">
          <h2>Add the badge to your site</h2>
          <p>Get listed in the directory by adding the "Built with SaasMaker" badge.</p>
          <div className="dir-badge-variants">
            <div className="dir-badge-preview">
              <a href="#" className="smb-preview smb-preview--flat">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect width="16" height="16" rx="3.5" fill="url(#pg1)" />
                  <text x="8" y="11.5" textAnchor="middle" fill="white" fontSize="8" fontWeight="900" fontFamily="-apple-system,sans-serif">SM</text>
                  <defs><linearGradient id="pg1" x1="0" y1="0" x2="16" y2="16"><stop stopColor="#3b82f6" /><stop offset="1" stopColor="#7c3aed" /></linearGradient></defs>
                </svg>
                <span>Built with SaasMaker</span>
              </a>
              <span className="dir-badge-label">Flat</span>
            </div>
            <div className="dir-badge-preview">
              <a href="#" className="smb-preview smb-preview--outlined">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect width="16" height="16" rx="3.5" fill="url(#pg2)" />
                  <text x="8" y="11.5" textAnchor="middle" fill="white" fontSize="8" fontWeight="900" fontFamily="-apple-system,sans-serif">SM</text>
                  <defs><linearGradient id="pg2" x1="0" y1="0" x2="16" y2="16"><stop stopColor="#3b82f6" /><stop offset="1" stopColor="#7c3aed" /></linearGradient></defs>
                </svg>
                <span>Built with SaasMaker</span>
              </a>
              <span className="dir-badge-label">Outlined</span>
            </div>
          </div>
          <div className="dir-code-block">
            <p className="dir-code-label">React</p>
            <pre><code>{`import { SaasMakerBadge } from '@saas-maker/badge'

<SaasMakerBadge variant="flat" theme="auto" />`}</code></pre>
          </div>
          <div className="dir-code-block">
            <p className="dir-code-label">HTML</p>
            <pre><code>{`<a href="https://sassmaker.com/made-with" target="_blank"
   style="display:inline-flex;align-items:center;gap:6px;padding:5px 10px;
          background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;
          text-decoration:none;font-family:sans-serif;font-size:12px;
          font-weight:500;color:#475569;">
  Built with SaasMaker
</a>`}</code></pre>
          </div>
          <button className="btn btn-primary btn-lg" onClick={() => setShowModal(true)}>
            Submit your product →
          </button>
        </div>
      </main>

      {showModal && (
        <SubmitModal
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); setSubmitted(true); }}
        />
      )}

      {submitted && (
        <div className="dir-toast">
          Submitted! We'll review your listing shortly.
          <button onClick={() => setSubmitted(false)} aria-label="Dismiss">&#x2715;</button>
        </div>
      )}
    </>
  );
}
