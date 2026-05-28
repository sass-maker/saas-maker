export function reviewPageHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Reel Pipeline Review</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #070707; color: #f5f5f5; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: radial-gradient(circle at top, #1f2937 0, #070707 52%); }
    main { width: min(760px, 100%); margin: 0 auto; padding: 24px; }
    header { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin-bottom: 22px; }
    h1 { margin: 0; font-size: clamp(32px, 7vw, 58px); letter-spacing: -0.06em; line-height: 0.92; }
    .sub { margin: 8px 0 0; color: #a3a3a3; font-size: 15px; }
    .pill { border: 1px solid #3f3f46; border-radius: 999px; padding: 8px 12px; color: #d4d4d8; background: rgba(24, 24, 27, 0.8); white-space: nowrap; }
    .deck { position: relative; min-height: 620px; display: grid; place-items: center; }
    .card { width: min(100%, 460px); min-height: 590px; border: 1px solid rgba(255,255,255,0.14); border-radius: 34px; padding: 24px; background: linear-gradient(160deg, rgba(39,39,42,0.96), rgba(10,10,10,0.98)); box-shadow: 0 40px 90px rgba(0,0,0,0.55); display: flex; flex-direction: column; gap: 18px; touch-action: pan-y; transition: transform 160ms ease, opacity 160ms ease; }
    .card.dragging { transition: none; }
    .project { display: flex; justify-content: space-between; align-items: center; gap: 12px; color: #a7f3d0; text-transform: uppercase; letter-spacing: 0.16em; font-size: 12px; }
    .channel { color: #fde68a; border: 1px solid rgba(253,230,138,0.28); border-radius: 999px; padding: 5px 9px; letter-spacing: 0; text-transform: none; }
    h2 { margin: 0; font-size: 34px; letter-spacing: -0.04em; line-height: 1; }
    .hook { font-size: 19px; line-height: 1.35; color: #e5e7eb; margin: 0; }
    .brief { flex: 1; overflow: auto; border: 1px solid rgba(255,255,255,0.1); border-radius: 22px; padding: 16px; background: rgba(0,0,0,0.28); color: #d4d4d8; white-space: pre-wrap; line-height: 1.42; font-size: 14px; }
    .meta { color: #a1a1aa; font-size: 13px; display: flex; flex-wrap: wrap; gap: 8px; }
    .meta span { border: 1px solid rgba(255,255,255,0.1); border-radius: 999px; padding: 6px 9px; }
    .actions { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    button { border: 0; border-radius: 20px; padding: 17px 18px; font: inherit; font-weight: 800; cursor: pointer; color: #09090b; }
    .reject { background: #fb7185; }
    .approve { background: #34d399; }
    .empty, .error { border: 1px dashed #3f3f46; border-radius: 28px; padding: 28px; color: #d4d4d8; background: rgba(24,24,27,0.72); text-align: center; }
    .hint { color: #a1a1aa; text-align: center; font-size: 13px; margin-top: 14px; }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>Reel Review</h1>
        <p class="sub">Swipe left to reject. Swipe right to approve. Keyboard works too.</p>
      </div>
      <div class="pill"><span id="count">0</span> pending</div>
    </header>
    <section class="deck" id="deck"><div class="empty">Loading reel drafts...</div></section>
    <p class="hint">← reject · → approve · approval only changes review state, it does not autopost</p>
  </main>
  <script>
    const deck = document.querySelector('#deck');
    const count = document.querySelector('#count');
    let reels = [];
    let current = 0;
    let startX = 0;
    let deltaX = 0;

    async function load() {
      const res = await fetch('/reels?status=generated');
      if (!res.ok) throw new Error('Could not load reels');
      const payload = await res.json();
      reels = payload.data || [];
      current = 0;
      render();
    }

    function render() {
      count.textContent = String(Math.max(reels.length - current, 0));
      const reel = reels[current];
      if (!reel) {
        deck.innerHTML = '<div class="empty">No generated reels left to review.</div>';
        return;
      }
      deck.innerHTML = '<article class="card" id="card">' +
        '<div class="project"><strong>' + escapeHtml(reel.projectSlug) + '</strong><span class="channel">' + escapeHtml(reel.channel) + '</span></div>' +
        '<h2>' + escapeHtml(reel.title) + '</h2>' +
        '<p class="hook">' + escapeHtml(reel.hook) + '</p>' +
        '<div class="brief">' + escapeHtml(reel.body) + '</div>' +
        '<div class="meta">' +
          (reel.audience ? '<span>' + escapeHtml(reel.audience) + '</span>' : '') +
          (reel.productUrl ? '<span>' + escapeHtml(reel.productUrl) + '</span>' : '') +
          '<span>' + escapeHtml(reel.id) + '</span>' +
        '</div>' +
        '<div class="actions"><button class="reject" id="reject">Reject</button><button class="approve" id="approve">Approve</button></div>' +
      '</article>';
      const card = document.querySelector('#card');
      document.querySelector('#reject').onclick = () => decide('reject');
      document.querySelector('#approve').onclick = () => decide('approve');
      card.addEventListener('pointerdown', event => {
        startX = event.clientX;
        deltaX = 0;
        card.setPointerCapture(event.pointerId);
        card.classList.add('dragging');
      });
      card.addEventListener('pointermove', event => {
        if (!startX) return;
        deltaX = event.clientX - startX;
        card.style.transform = 'translateX(' + deltaX + 'px) rotate(' + (deltaX / 18) + 'deg)';
      });
      card.addEventListener('pointerup', () => {
        card.classList.remove('dragging');
        if (deltaX > 110) return decide('approve');
        if (deltaX < -110) return decide('reject');
        card.style.transform = '';
        startX = 0;
        deltaX = 0;
      });
    }

    async function decide(decision) {
      const reel = reels[current];
      if (!reel) return;
      const card = document.querySelector('#card');
      if (card) {
        const direction = decision === 'approve' ? 1 : -1;
        card.style.transform = 'translateX(' + (direction * 520) + 'px) rotate(' + (direction * 22) + 'deg)';
        card.style.opacity = '0';
      }
      const res = await fetch('/reels/' + encodeURIComponent(reel.id) + '/decision', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        deck.innerHTML = '<div class="error">' + escapeHtml(payload.error || 'Decision failed') + '</div>';
        return;
      }
      current += 1;
      setTimeout(render, 120);
    }

    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    }

    document.addEventListener('keydown', event => {
      if (event.key === 'ArrowLeft') decide('reject');
      if (event.key === 'ArrowRight') decide('approve');
    });
    load().catch(error => {
      deck.innerHTML = '<div class="error">' + escapeHtml(error.message) + '</div>';
    });
  </script>
</body>
</html>`;
}
