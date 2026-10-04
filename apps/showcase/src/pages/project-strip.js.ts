import browserBundle from '../../../../packages/portfolio-project-strip/dist/browser/element.mjs?raw';
import { classicBrowserBundle } from '../lib/classic-browser-bundle';

const source = `(() => {
  'use strict';
  ${classicBrowserBundle(browserBundle)}
  const script = document.currentScript;
  const mount = (authoredHost) => {
    if (!script || script.dataset.auto === 'false') return;
    const host = authoredHost instanceof HTMLElement && authoredHost.localName === 'fleet-footer-extension'
      ? authoredHost : document.querySelector('fleet-footer-extension');
    if (script.dataset.hostOnly === 'true' && !host) return;
    if (host?.querySelector('portfolio-project-strip') || (!host && document.querySelector('portfolio-project-strip'))) return;
    const strip = document.createElement('portfolio-project-strip');
    if (script.dataset.project) strip.setAttribute('current-project', script.dataset.project);
    if (script.dataset.label) strip.setAttribute('label', script.dataset.label);
    if (script.dataset.theme) strip.setAttribute('theme', script.dataset.theme);
    if (script.dataset.speed) strip.setAttribute('speed', script.dataset.speed);
    if (script.dataset.layout) strip.setAttribute('layout', script.dataset.layout);
    if (host) { strip.slot = 'projects'; host.append(strip); }
    else document.body.append(strip);
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
