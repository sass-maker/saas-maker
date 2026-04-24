(function () {
  const API_PATH = '/v1/analytics/events';

  // Find our script tag and read config
  const scripts = document.querySelectorAll('script[data-project]');
  const scriptEl = scripts[scripts.length - 1] as HTMLScriptElement | undefined;
  if (!scriptEl) return;

  const projectKey = scriptEl.getAttribute('data-project');
  if (!projectKey) return;

  const apiBase = scriptEl.getAttribute('data-api') || 'https://api.sassmaker.com';

  // Respect Do Not Track
  if (navigator.doNotTrack === '1') return;

  // --- Queue (for calls before script load) ---
  type QueueItem = [string, Record<string, unknown>?];
  const win = window as any;
  const queue: QueueItem[] = win.sm?.q || [];

  // --- Send event ---
  function send(name: string, props?: Record<string, unknown>) {
    const payload: Record<string, unknown> = {
      name,
      url: location.href,
      referrer: document.referrer || undefined,
      screen_width: window.innerWidth,
    };

    // Extract UTM params
    const params = new URLSearchParams(location.search);
    const utm_source = params.get('utm_source');
    const utm_medium = params.get('utm_medium');
    const utm_campaign = params.get('utm_campaign');
    if (utm_source) payload.utm_source = utm_source;
    if (utm_medium) payload.utm_medium = utm_medium;
    if (utm_campaign) payload.utm_campaign = utm_campaign;

    if (props && Object.keys(props).length > 0) {
      payload.properties = props;
    }

    // Clean undefineds
    for (const key of Object.keys(payload)) {
      if (payload[key] === undefined) delete payload[key];
    }

    const body = JSON.stringify(payload);
    const endpoint = apiBase + API_PATH;

    fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Project-Key': projectKey!,
      },
      body,
      keepalive: true,
    }).catch(() => {});
  }

  // --- Public API ---
  function track(name: string, properties?: Record<string, unknown>) {
    send(name, properties);
  }

  // Expose globally
  win.sm = track;
  win.sm.track = track;

  // Flush queue
  for (const [name, props] of queue) {
    track(name, props);
  }

  // --- Auto page view ---
  let lastUrl = '';

  function pageView() {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    send('page_view');
  }

  // Initial page view
  pageView();

  // SPA support: patch pushState/replaceState
  const origPush = history.pushState;
  const origReplace = history.replaceState;

  history.pushState = function (...args) {
    origPush.apply(this, args);
    pageView();
  };

  history.replaceState = function (...args) {
    origReplace.apply(this, args);
    pageView();
  };

  window.addEventListener('popstate', pageView);
})();
