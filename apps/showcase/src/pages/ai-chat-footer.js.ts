import publicProducts from '../../../../catalog/generated/public.json';
import { resolveFooterArt } from '../../../../packages/fleet-footer/src/artwork.mjs';
import { registerFleetFooter } from '../../../../packages/fleet-footer/src/element.mjs';
import chatgptLogo from '../../../../packages/ai-chat-footer/src/assets/provider-logos/chatgpt.jpg?inline';
import claudeLogo from '../../../../packages/ai-chat-footer/src/assets/provider-logos/claude.jpg?inline';
import geminiLogo from '../../../../packages/ai-chat-footer/src/assets/provider-logos/gemini.jpg?inline';
import grokLogo from '../../../../packages/ai-chat-footer/src/assets/provider-logos/grok.jpg?inline';
import perplexityLogo from '../../../../packages/ai-chat-footer/src/assets/provider-logos/perplexity.jpg?inline';
import capturePolicy from '../../../../tooling/config/capture-projects.json';

const providerLogos = {
  claude: claudeLogo,
  chatgpt: chatgptLogo,
  gemini: geminiLogo,
  perplexity: perplexityLogo,
  grok: grokLogo,
};

const feedbackLauncherCss = `
  [data-saas-maker-feedback-launcher] {
    display: inline-flex; min-width: 44px; min-height: 44px; align-items: center; justify-content: center;
    padding: .65rem 1rem; border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
    border-radius: .65rem; background: transparent; color: inherit; font: inherit;
    font-weight: 680; line-height: 1.3; cursor: pointer; text-align: center;
    transition: background-color 160ms ease, border-color 160ms ease;
  }
  [data-saas-maker-feedback-root] { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 1rem; width: min(100% - 2rem, 72rem); margin: 1.25rem auto; padding: 1.25rem; border: 1px solid color-mix(in srgb, currentColor 18%, transparent); border-radius: 1rem; background: color-mix(in srgb, currentColor 4%, transparent); color: inherit; font-family: inherit; font-size: 14px; line-height: 1.45; }
  [data-saas-maker-feedback-root] .saas-maker-feedback-copy { min-width: 0; }
  [data-saas-maker-feedback-root] h2 { margin: 0; font-size: clamp(1rem, 2vw, 1.25rem); font-weight: 720; letter-spacing: -.025em; line-height: 1.2; }
  [data-saas-maker-feedback-root] p { margin: .4rem 0 0; color: color-mix(in srgb, currentColor 76%, transparent); }
  [data-saas-maker-feedback-launcher]:hover:not(:disabled) { border-color: color-mix(in srgb, currentColor 36%, transparent); background: color-mix(in srgb, currentColor 6%, transparent); }
  [data-saas-maker-feedback-launcher]:focus-visible { outline: 2px solid #2563eb; outline-offset: 3px; }
  [data-saas-maker-feedback-launcher]:disabled { cursor: wait; opacity: .75; }
  [data-saas-maker-feedback-root] .saas-maker-feedback-status { grid-column: 1 / -1; color: #a32929; font: 12px/1.4 system-ui, sans-serif; }
  [data-saas-maker-feedback-root][slot='feedback'] { display: block; width: 100%; margin: 0; padding: 0; border: 0; background: transparent; }
  [data-saas-maker-feedback-root][slot='feedback'] [data-saas-maker-feedback-launcher] { width: 100%; margin-block-start: 1rem; }
  [data-saas-maker-feedback-root][slot='feedback'] .saas-maker-feedback-status { display: block; margin-block-start: .5rem; }
  @media (max-width: 560px) { [data-saas-maker-feedback-root] { grid-template-columns: minmax(0, 1fr); } [data-saas-maker-feedback-launcher] { width: 100%; } }
  @media (prefers-reduced-motion: reduce) { [data-saas-maker-feedback-launcher] { transition: none; } }
`;

const autoCaptureKinds = Object.fromEntries(
  capturePolicy.projects
    .filter(({ applicability }) => applicability === 'newsletter' || applicability === 'waitlist')
    .map(({ id, applicability }) => [id, applicability])
);

const footerArt = Object.fromEntries(
  [
    ...new Set([
      ...publicProducts.directory.map(({ id }) => id),
      ...Object.keys(autoCaptureKinds),
      'memory-map',
      'high-signal-podcasts',
      'portfolio',
      'aliveville',
    ]),
  ]
    .map((id) => [id, resolveFooterArt(publicProducts, id)])
    .filter(([, artwork]) => artwork !== undefined)
);

const source = `(() => {
  'use strict';

  const PROVIDER_LOGOS = ${JSON.stringify(providerLogos)};
  const AUTO_CAPTURE_KINDS = ${JSON.stringify(autoCaptureKinds)};
  const FOOTER_ART = ${JSON.stringify(footerArt)};
  const PROVIDERS = [
    ['claude', 'Claude', (prompt) => 'https://claude.ai/new?q=' + encodeURIComponent(prompt)],
    ['chatgpt', 'ChatGPT', (prompt) => 'https://chatgpt.com/?q=' + encodeURIComponent(prompt)],
    ['gemini', 'Gemini', (prompt) => 'https://gemini.google.com/app?is_sa=1&is_sa_p=' + encodeURIComponent(prompt)],
    ['perplexity', 'Perplexity', (prompt) => 'https://www.perplexity.ai/?q=' + encodeURIComponent(prompt)],
    ['grok', 'Grok', (prompt) => 'https://grok.com/?q=' + encodeURIComponent(prompt)],
  ];

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const createProviderLogo = (provider) => {
    const image = document.createElement('img');
    image.src = PROVIDER_LOGOS[provider];
    image.alt = '';
    image.setAttribute('aria-hidden', 'true');
    image.decoding = 'async';
    return image;
  };

  const interpolate = (template, name, url) => template
    .replaceAll('{companyName}', name)
    .replaceAll('{companyUrl}', url);

  class AIChatFooter extends HTMLElement {
    connectedCallback() { this.render(); }

    render() {
      const name = this.getAttribute('product-name') || 'this product';
      const url = this.getAttribute('product-url') || window.location.origin;
      const label = this.getAttribute('label') || 'Explore ' + name + ' with AI';
      const prompt = interpolate(
        this.getAttribute('prompt') || 'What does {companyName} ({companyUrl}) do, and who is it best for? Keep it concise.',
        name,
        url,
      );
      const allowed = new Set((this.getAttribute('providers') || PROVIDERS.map(([id]) => id).join(','))
        .split(',').map((value) => value.trim().toLowerCase()));
      const root = this.shadowRoot || this.attachShadow({ mode: 'open' });
      root.replaceChildren();

      const style = document.createElement('style');
      style.textContent = \`
        :host { --ai-footer-muted: color-mix(in srgb, currentColor 72%, transparent); --ai-footer-border: color-mix(in srgb, currentColor 18%, transparent); --ai-footer-control: color-mix(in srgb, currentColor 4%, transparent); --ai-footer-focus: #2563eb; display: block; color: inherit; background: transparent; font: inherit; }
        :host([theme='light']) { color-scheme: light; }
        :host([theme='dark']) { color-scheme: dark; }
        * { box-sizing: border-box; }
        aside { display: grid; grid-template-columns: minmax(13rem, .72fr) minmax(0, 1.28fr); align-items: center; gap: clamp(1.25rem, 3vw, 3rem); padding: 1.25rem var(--ai-footer-edge, 1.25rem); border-block-start: 1px solid var(--ai-footer-border); }
        :host([integrated]) aside { border-block-start: 0; }
        p { margin: 0; }
        .intro { display: grid; grid-template-columns: 2.5rem minmax(0, 1fr); align-items: start; gap: .8rem; }
        .signal { display: grid; width: 2.5rem; height: 2.5rem; place-items: center; border: 1px solid var(--ai-footer-border); border-radius: .75rem; background: var(--ai-footer-control); }
        .signal svg { width: 1.15rem; height: 1.15rem; fill: currentColor; }
        .title { margin: 0; font-size: clamp(1rem, 1.4vw, 1.15rem); font-weight: 720; letter-spacing: -.025em; line-height: 1.2; }
        .description { max-width: 36rem; margin-top: .3rem; color: var(--ai-footer-muted); font-size: .78rem; line-height: 1.45; }
        ul { display: flex; flex-wrap: nowrap; justify-content: flex-end; gap: .25rem; margin: 0; padding: 0; list-style: none; }
        a { display: grid; width: 2.75rem; height: 2.75rem; min-height: 2.75rem; place-items: center; padding: .375rem; border: 1px solid transparent; border-radius: .75rem; background: transparent; color: inherit; text-decoration: none; transition: background-color 150ms ease, border-color 150ms ease, transform 150ms ease; }
        a:hover { border-color: var(--ai-footer-border); background: var(--ai-footer-control); transform: translateY(-1px); }
        a:focus-visible { outline: 2px solid var(--ai-footer-focus); outline-offset: 2px; }
        a img { display: block; width: 2rem; height: 2rem; border-radius: .625rem; object-fit: cover; }
        @media (max-width: 1000px) { aside { grid-template-columns: minmax(0, 1fr); gap: 1rem; } ul { justify-content: flex-start; } }
        :host([layout='compact']) aside { grid-template-columns: minmax(0, 1fr); gap: 1rem; padding: 0; }
        :host([layout='compact']) ul { flex-wrap: wrap; justify-content: flex-start; }
        @media (prefers-reduced-motion: reduce) { a { transition: background-color 150ms ease, border-color 150ms ease; } a:hover { transform: none; } }
      \`;

      const aside = document.createElement('aside');
      aside.setAttribute('aria-label', 'Chat with AI about this product');
      const intro = document.createElement('div');
      intro.className = 'intro';
      const signal = document.createElement('span');
      signal.className = 'signal';
      signal.setAttribute('aria-hidden', 'true');
      const sparkle = document.createElementNS(SVG_NS, 'svg');
      sparkle.setAttribute('viewBox', '0 0 16 16');
      sparkle.setAttribute('aria-hidden', 'true');
      const sparklePath = document.createElementNS(SVG_NS, 'path');
      sparklePath.setAttribute('d', 'M8 1.5c.35 3.65 2.85 6.15 6.5 6.5-3.65.35-6.15 2.85-6.5 6.5C7.65 10.85 5.15 8.35 1.5 8 5.15 7.65 7.65 5.15 8 1.5Z');
      sparkle.append(sparklePath);
      signal.append(sparkle);
      const copy = document.createElement('div');
      const heading = document.createElement('h2');
      heading.className = 'title';
      heading.textContent = label;
      const description = document.createElement('p');
      description.className = 'description';
      description.textContent = 'Open a pre-filled question in a new tab with the assistant you already use.';
      const list = document.createElement('ul');
      for (const [id, providerName, buildUrl] of PROVIDERS) {
        if (!allowed.has(id)) continue;
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.href = buildUrl(prompt);
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.dataset.aiProvider = id;
        link.title = providerName;
        link.setAttribute('aria-label', 'Ask ' + providerName + ' about ' + name + ' (opens in a new tab)');
        link.append(createProviderLogo(id));
        item.append(link);
        list.append(item);
      }
      copy.append(heading, description);
      intro.append(signal, copy);
      aside.append(intro, list);
      root.append(style, aside);
    }
  }

  if (!customElements.get('ai-chat-footer')) customElements.define('ai-chat-footer', AIChatFooter);

  (${registerFleetFooter.toString()})();

  const script = document.currentScript;
  const captureModuleAttempts = new WeakMap();
  const mountCapture = async (extension, strip) => {
    if (extension.dataset.capturePending === 'true' || extension.dataset.captureConfigured === 'true') return;
    const catalogId = strip.getAttribute('current-project');
    if (!catalogId || !/^[a-z0-9-]+$/.test(catalogId)) return;
    const captureKind = AUTO_CAPTURE_KINDS[catalogId];
    const nativeCapture = document.querySelector('saas-maker-newsletter-capture');
    const showUpdates = script.dataset.capture !== 'false' && Boolean(captureKind) && !nativeCapture;
    extension.setAttribute('show-updates', String(showUpdates));
    extension.setAttribute('capture-status', 'loading');
    extension.dataset.capturePending = 'true';
    const controller = new AbortController();
    const configTimeout = window.setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch('https://api.sassmaker.com/v1/capture-config/' + catalogId, {
        headers: { accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('Capture unavailable');
      const config = await response.json();
      window.clearTimeout(configTimeout);
      if (!config || typeof config.api_key !== 'string' || !/^pk_[a-z0-9]+$/.test(config.api_key)) throw new Error('Capture unavailable');
      if (!extension.isConnected) { extension.setAttribute('capture-status', 'unavailable'); return; }
      mountFeedback(config.api_key, extension);
      if (script.dataset.capture === 'false' || !captureKind || document.querySelector('saas-maker-newsletter-capture')) {
        extension.setAttribute('show-updates', 'false');
        extension.dataset.captureConfigured = 'true';
        return;
      }
      if (!customElements.get('saas-maker-newsletter-capture')) {
        await new Promise((resolve, reject) => {
          const loader = document.createElement('script');
          loader.type = 'module';
          const attempt = captureModuleAttempts.get(extension) || 0;
          loader.src = 'https://sassmaker.com/newsletter-capture.js' + (attempt ? '?retry=' + attempt : '');
          loader.crossOrigin = 'anonymous';
          let settled = false;
          let timeout;
          const fail = () => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timeout);
            captureModuleAttempts.set(extension, attempt + 1);
            loader.remove();
            reject(new Error('Capture unavailable'));
          };
          timeout = window.setTimeout(fail, 8000);
          loader.onload = () => {
            if (settled) return;
            if (!customElements.get('saas-maker-newsletter-capture')) { fail(); return; }
            settled = true;
            window.clearTimeout(timeout);
            resolve();
          };
          loader.onerror = fail;
          document.head.append(loader);
        });
      }
      if (!extension.isConnected) { extension.setAttribute('capture-status', 'unavailable'); return; }
      if (document.querySelector('saas-maker-newsletter-capture')) {
        extension.setAttribute('show-updates', 'false');
        extension.dataset.captureConfigured = 'true';
        return;
      }
      const capture = document.createElement('saas-maker-newsletter-capture');
      capture.setAttribute('project-key', config.api_key);
      capture.setAttribute('catalog-id', catalogId);
      capture.setAttribute('product-name', script.dataset.name || config.name || catalogId);
      capture.setAttribute('kind', captureKind);
      capture.setAttribute('source', 'fleet-footer');
      capture.setAttribute('privacy-url', 'https://sassmaker.com/privacy');
      capture.setAttribute('layout', 'compact');
      capture.setAttribute('integrated', '');
      if (extension.getAttribute('theme')) capture.setAttribute('theme', extension.getAttribute('theme'));
      capture.slot = 'capture';
      extension.append(capture);
      extension.setAttribute('capture-status', 'ready');
      extension.dataset.captureConfigured = 'true';
    } catch {
      extension.setAttribute('capture-status', 'unavailable');
    } finally { window.clearTimeout(configTimeout); delete extension.dataset.capturePending; }
  };
  const mountFeedback = (apiKey, extension) => {
    if (script.dataset.feedback === 'false' || document.querySelector('[data-saas-maker-feedback-root]')) return;
    const hasExistingWidget = (host) => Array.from(document.querySelectorAll('[data-feedback-widget]'))
      .some((widget) => !host.contains(widget));
    if (hasExistingWidget(document.createElement('div'))) return;
    const host = document.createElement('section');
    host.dataset.saasMakerFeedbackRoot = 'true';
    host.slot = 'feedback';
    host.setAttribute('aria-label', 'Feedback and support');
    const copy = document.createElement('div');
    copy.className = 'saas-maker-feedback-copy';
    const heading = document.createElement('h2');
    heading.textContent = 'Help shape ' + (script.dataset.name || 'this product') + '.';
    const description = document.createElement('p');
    description.textContent = 'Have a question or an idea? Reach the team here, without covering the apps.';
    copy.append(heading, description);
    const launcher = document.createElement('button');
    launcher.type = 'button';
    launcher.dataset.saasMakerFeedbackLauncher = 'true';
    const launcherLabel = 'Send feedback ↗';
    launcher.setAttribute('aria-haspopup', 'dialog');
    launcher.setAttribute('aria-label', 'Send feedback');
    launcher.textContent = launcherLabel;
    const status = document.createElement('span');
    status.className = 'saas-maker-feedback-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    const widgetRoot = document.createElement('div');
    widgetRoot.dataset.saasMakerFeedbackMount = 'true';
    host.append(copy, launcher, status, widgetRoot);
    const style = document.createElement('style');
    style.dataset.saasMakerFeedbackStyle = 'true';
    style.textContent = ${JSON.stringify(feedbackLauncherCss)};
    document.head.append(style);
    extension.append(host);
    const pageUrl = window.location.origin + window.location.pathname;
    const productTitle = document.title || script.dataset.name || 'Product';
    const options = { apiKey, pageUrl, pageTitle: productTitle };
    let active = true;
    let loading = false;
    let mounted = false;
    let observer;
    let loader;
    const removeLauncher = () => {
      if (!active) return;
      active = false;
      observer?.disconnect();
      loader?.remove();
      window.SaasMakerFeedback?.unmountSharedFooterFeedback?.(widgetRoot);
      host.remove();
      style.remove();
      if (launcher.dataset.activated === 'true') {
        document.querySelector('[data-feedback-widget] .smw-trigger')?.focus();
      }
    };
    const openWidget = () => {
      if (!active || hasExistingWidget(host)) { removeLauncher(); return; }
      const api = window.SaasMakerFeedback;
      if (mounted && typeof api?.openSharedFooterFeedback === 'function') {
        api.openSharedFooterFeedback(widgetRoot, options);
        return;
      }
      if (loading) return;
      if (typeof api?.mountSharedFooterFeedback === 'function') {
        api.mountSharedFooterFeedback(widgetRoot, options);
        mounted = true;
        launcher.textContent = launcherLabel;
        launcher.disabled = false;
        status.textContent = '';
        return;
      }
      loading = true;
      status.textContent = '';
      launcher.disabled = true;
      launcher.textContent = 'Loading…';
      loader = document.createElement('script');
      loader.src = 'https://sassmaker.com/feedback-launcher.js';
      loader.crossOrigin = 'anonymous';
      loader.onload = () => {
        loading = false;
        if (!active || hasExistingWidget(host)) { removeLauncher(); return; }
        const loadedApi = window.SaasMakerFeedback;
        if (typeof loadedApi?.mountSharedFooterFeedback !== 'function') {
          launcher.disabled = false;
          launcher.textContent = launcherLabel;
          status.textContent = 'Feedback could not load. Try again.';
          loader.remove();
          return;
        }
        loadedApi.mountSharedFooterFeedback(widgetRoot, options);
        mounted = true;
        launcher.disabled = false;
        launcher.textContent = launcherLabel;
        status.textContent = '';
      };
      loader.onerror = () => {
        loading = false;
        launcher.disabled = false;
        launcher.textContent = launcherLabel;
        status.textContent = 'Feedback could not load. Try again.';
        loader.remove();
      };
      document.head.append(loader);
    };
    launcher.addEventListener('click', () => {
      launcher.dataset.activated = 'true';
      openWidget();
    });
    observer = new MutationObserver(() => {
      if (active && hasExistingWidget(host)) removeLauncher();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  };
  const mount = (authoredHost) => {
    if (!script || script.dataset.auto === 'false') return;
    const host = authoredHost instanceof HTMLElement && authoredHost.localName === 'fleet-footer-extension'
      ? authoredHost : document.querySelector('fleet-footer-extension');
    if (script.dataset.hostOnly === 'true' && !host) return;
    const footer = host?.querySelector('ai-chat-footer') || document.querySelector('ai-chat-footer') || document.createElement('ai-chat-footer');
    footer.setAttribute('product-name', script.dataset.name || footer.getAttribute('product-name') || document.title || 'this product');
    footer.setAttribute('product-url', script.dataset.url || footer.getAttribute('product-url') || window.location.origin);
    for (const attribute of ['label', 'prompt', 'providers', 'theme', 'layout']) {
      if (script.dataset[attribute]) footer.setAttribute(attribute, script.dataset[attribute]);
    }
    const compose = () => {
      const strip = host?.querySelector('portfolio-project-strip') || document.querySelector('portfolio-project-strip');
      if (!strip || script.dataset.compose === 'false') return false;
      const extension = host || document.createElement('fleet-footer-extension');
      extension.setAttribute('product-name', footer.getAttribute('product-name'));
      if (script.dataset.surface) extension.setAttribute('surface', script.dataset.surface);
      const theme = script.dataset.theme || footer.getAttribute('theme') || strip.getAttribute('theme');
      if (theme) extension.setAttribute('theme', theme);
      for (const name of ['src', 'alt', 'width', 'height', 'position', 'credit']) {
        const value = script.dataset['art' + name[0].toUpperCase() + name.slice(1)];
        if (value) extension.setAttribute('art-' + name, value);
      }
      const artwork = FOOTER_ART[strip.getAttribute('current-project')];
      if (artwork) {
        const defaults = {
          src: new URL(artwork.src, 'https://sassmaker.com').href,
          alt: artwork.alt,
          width: artwork.width,
          height: artwork.height,
          position: artwork.focalX + '% ' + artwork.focalY + '%',
          credit: artwork.credit,
        };
        for (const [name, value] of Object.entries(defaults)) {
          if (!extension.hasAttribute('art-' + name)) extension.setAttribute('art-' + name, String(value));
        }
      }
      const cta = extension.querySelector('[data-fleet-footer-cta]') || document.querySelector('[data-fleet-footer-cta]');
      const navigation = extension.querySelector('[data-fleet-footer-navigation]') || document.querySelector('[data-fleet-footer-navigation]');
      if (!extension.isConnected) {
        const anchor = cta || navigation;
        if (anchor?.parentElement && !anchor.contains(extension)) anchor.parentElement.insertBefore(extension, anchor);
        else {
          // Legacy insertion position only: unmarked native content is never adopted.
          const capture = document.querySelector('saas-maker-newsletter-capture');
          const pageFooter = capture?.closest('footer') || document.querySelector('footer');
          if (pageFooter?.parentElement) pageFooter.parentElement.insertBefore(extension, pageFooter);
          else if (capture?.parentElement) capture.parentElement.insertBefore(extension, capture);
          else document.body.append(extension);
        }
      }
      for (const [node, slot] of [[cta, 'cta'], [navigation, 'navigation']]) {
        if (!node || node === extension || node.contains(extension)) continue;
        node.slot = slot;
        if (node.parentElement !== extension) extension.append(node);
      }
      footer.setAttribute('integrated', '');
      footer.setAttribute('layout', 'compact');
      footer.slot = 'ai';
      strip.setAttribute('integrated', '');
      strip.setAttribute('layout', 'curated');
      if (theme) { footer.setAttribute('theme', theme); strip.setAttribute('theme', theme); }
      strip.slot = 'projects';
      if (footer.parentElement !== extension) extension.append(footer);
      if (strip.parentElement !== extension) extension.append(strip);
      if (extension.dataset.captureRetryBound !== 'true') {
        extension.dataset.captureRetryBound = 'true';
        extension.addEventListener('capture-retry', () => void mountCapture(extension, strip));
        extension.addEventListener('footer-connect', () => void mountCapture(extension, strip));
      }
      void mountCapture(extension, strip);
      return true;
    };
    if (compose()) return;
    if (!footer.isConnected) document.body.append(footer);
    if (script.dataset.compose === 'false') return;
    let stopWaiting = 0;
    const observer = new MutationObserver(() => {
      if (!compose()) return;
      observer.disconnect();
      window.clearTimeout(stopWaiting);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    stopWaiting = window.setTimeout(() => observer.disconnect(), 10000);
  };
  document.addEventListener('footer-connect', (event) => {
    const host = event.target;
    if (host instanceof HTMLElement && host.localName === 'fleet-footer-extension' &&
        script?.dataset.project && host.dataset.fleetFooterProject === script.dataset.project) mount(host);
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();`;

export function GET() {
  return new Response(source, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400',
      'Content-Type': 'text/javascript; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
