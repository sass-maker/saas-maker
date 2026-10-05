import publicProducts from '../../../../catalog/generated/public.json';
import { resolveFooterArt } from '../../../../packages/fleet-footer/src/artwork.mjs';
import { registerFleetFooter } from '../../../../packages/fleet-footer/src/element.mjs';
import aiBrowserBundle from '../../../../packages/ai-chat-footer/dist/browser/element.mjs?raw';
import { classicBrowserBundle } from '../lib/classic-browser-bundle';
import capturePolicy from '../../../../tooling/config/capture-projects.json';

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
  [data-saas-maker-feedback-launcher]:hover:not([aria-busy='true']) { border-color: color-mix(in srgb, currentColor 36%, transparent); background: color-mix(in srgb, currentColor 6%, transparent); }
  [data-saas-maker-feedback-launcher]:focus-visible { outline: 2px solid #2563eb; outline-offset: 3px; }
  [data-saas-maker-feedback-launcher][aria-busy='true'] { cursor: wait; opacity: .75; }
  [data-saas-maker-feedback-root] .saas-maker-feedback-status { grid-column: 1 / -1; color: #a32929; font: 12px/1.4 system-ui, sans-serif; }
  [data-saas-maker-feedback-root][slot='feedback'] { display: block; width: 100%; margin: 0; padding: 0; border: 0; background: transparent; }
  [data-saas-maker-feedback-root][slot='feedback'] h2 { font-size: 1rem; font-weight: 600; line-height: 1.35; }
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

  const AUTO_CAPTURE_KINDS = ${JSON.stringify(autoCaptureKinds)};
  const FOOTER_ART = ${JSON.stringify(footerArt)};
  ${classicBrowserBundle(aiBrowserBundle)}

  (${registerFleetFooter.toString()})();

  const script = document.currentScript;
  const assetBase = new URL('.', script?.src || 'https://sassmaker.com/ai-chat-footer.js');
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
        extension.setAttribute('capture-status', 'ready');
        extension.dataset.captureConfigured = 'true';
        return;
      }
      if (!customElements.get('saas-maker-newsletter-capture')) {
        await new Promise((resolve, reject) => {
          const loader = document.createElement('script');
          loader.type = 'module';
          const attempt = captureModuleAttempts.get(extension) || 0;
          loader.src = new URL('newsletter-capture.js', assetBase).href + (attempt ? '?retry=' + attempt : '');
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
        extension.setAttribute('capture-status', 'ready');
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
    description.textContent = 'Have a question or an idea? Share it here.';
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
        status.textContent = '';
        return;
      }
      loading = true;
      status.textContent = '';
      launcher.setAttribute('aria-busy', 'true');
      launcher.textContent = 'Loading…';
      loader = document.createElement('script');
      loader.src = new URL('feedback-launcher.js', assetBase).href;
      loader.crossOrigin = 'anonymous';
      loader.onload = () => {
        loading = false;
        if (!active || hasExistingWidget(host)) { removeLauncher(); return; }
        const loadedApi = window.SaasMakerFeedback;
        if (typeof loadedApi?.mountSharedFooterFeedback !== 'function') {
          launcher.removeAttribute('aria-busy');
          launcher.textContent = launcherLabel;
          status.textContent = 'Feedback could not load. Try again.';
          loader.remove();
          return;
        }
        loadedApi.mountSharedFooterFeedback(widgetRoot, options);
        mounted = true;
        launcher.removeAttribute('aria-busy');
        launcher.textContent = launcherLabel;
        status.textContent = '';
      };
      loader.onerror = () => {
        loading = false;
        launcher.removeAttribute('aria-busy');
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
      if (!extension.hasAttribute('font-base')) extension.setAttribute('font-base', new URL('fonts/fleet-footer-precise-v1/', assetBase).href);
      if (strip.getAttribute('current-project') === 'ph-catalog') {
        extension.setAttribute('signature-name', 'Atlas');
        extension.setAttribute('signature-font', 'newsreader');
      }
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
      footer.setAttribute('layout', 'question');
      footer.slot = 'ai';
      strip.setAttribute('integrated', '');
      strip.setAttribute('layout', 'studio');
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
