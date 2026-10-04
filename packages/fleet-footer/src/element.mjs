/** Precise composition only. Slotted children retain links, forms, state and API ownership. */
export function registerFleetFooter() {
  if (typeof window === 'undefined' || customElements.get('fleet-footer-extension')) return;
  // All helpers stay inside this function: hosted endpoints serialize its source.
  const safeFontBase = (raw) => {
    try {
      const url = new URL(
        raw || 'https://sassmaker.com/fonts/fleet-footer-precise-v1/',
        window.location.href
      );
      if (
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        !['http:', 'https:'].includes(url.protocol) ||
        (url.origin !== window.location.origin && url.origin !== 'https://sassmaker.com')
      )
        return null;
      if (!url.pathname.endsWith('/')) url.pathname += '/';
      return url.href;
    } catch {
      return null;
    }
  };
  const fontRegistry = (base) => {
    let key = 2166136261;
    for (const character of base) key = Math.imul(key ^ character.charCodeAt(0), 16777619) >>> 0;
    const suffix = key.toString(16);
    const families = {
      ui: `FleetGeist-${suffix}`,
      mono: `FleetGeistMono-${suffix}`,
      signature: `FleetNewsreader-${suffix}`,
    };
    if (!document.head.querySelector(`[data-fleet-footer-fonts="${suffix}"]`)) {
      const style = document.createElement('style');
      style.dataset.fleetFooterFonts = suffix;
      style.textContent = [
        [families.ui, 'geist.woff2', '100 900'],
        [families.mono, 'geistmono.woff2', '400'],
        [families.signature, 'newsreader.woff2', '200 800'],
      ]
        .map(
          ([family, file, weight]) =>
            `@font-face{font-family:"${family}";font-style:normal;font-weight:${weight};font-display:swap;src:url(${JSON.stringify(new URL(file, base).href)}) format("woff2")}`
        )
        .join('\n');
      document.head.append(style);
    }
    return families;
  };
  class FleetFooterExtension extends HTMLElement {
    static observedAttributes = [
      'product-name',
      'signature-name',
      'signature-font',
      'font-base',
      'fonts',
      'art-src',
      'art-alt',
      'art-width',
      'art-height',
      'art-position',
      'art-credit',
      'theme',
      'surface',
      'show-updates',
      'capture-status',
    ];
    connectedCallback() {
      this.resolveNativeCanvas();
      if (!this.shadowRoot) this.build();
      this.update();
      queueMicrotask(() => {
        if (this.isConnected)
          this.dispatchEvent(new CustomEvent('footer-connect', { bubbles: true, composed: true }));
      });
    }
    attributeChangedCallback(name) {
      if (this.shadowRoot) {
        if (name === 'theme') this.resolveNativeCanvas();
        this.update();
      }
    }
    resolveNativeCanvas() {
      // Only background color, at most eight ancestors; no content/data collection.
      let color;
      let node = this;
      for (let depth = 0; node && depth < 8; depth++, node = node.parentElement) {
        if (typeof window.getComputedStyle !== 'function') break;
        const candidate = window.getComputedStyle(node).backgroundColor;
        const match = /^rgba?\(([^)]+)\)$/.exec(candidate || '');
        if (!match) continue;
        const components = match[1].split(/[\s,/]+/).filter(Boolean);
        if (components.length === 3 || (components.length === 4 && Number(components[3]) === 1)) {
          color = candidate;
          break;
        }
      }
      this.style.setProperty(
        '--fleet-footer-native-canvas',
        color || (this.getAttribute('theme') === 'dark' ? '#171717' : '#fafaf9')
      );
    }
    build() {
      const root = this.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = `
        :host{--fleet-footer-canvas:var(--fleet-footer-native-canvas,#fafaf9);--fleet-footer-lower:var(--fleet-footer-canvas);--fleet-footer-ui-font:var(--fleet-footer-loaded-ui,system-ui,sans-serif);--fleet-footer-mono-font:var(--fleet-footer-loaded-mono,ui-monospace,monospace);--fleet-footer-label-font:var(--fleet-footer-mono-font);--fleet-footer-border:color-mix(in srgb,currentColor 18%,transparent);--fleet-footer-muted:color-mix(in srgb,currentColor 78%,transparent);--fleet-footer-focus:currentColor;display:block;width:100%;min-width:0;color:inherit;font:14px/1.55 var(--fleet-footer-ui-font);font-synthesis:none;border-block-start:1px solid var(--fleet-footer-border)}
        :host([theme=dark]){color-scheme:dark}:host([theme=light]){color-scheme:light}
        *{box-sizing:border-box}[hidden]{display:none!important}
        .frame{width:calc(100% - 2 * var(--fleet-footer-edge,3.5rem));max-width:var(--fleet-footer-max-width,83rem);margin-inline:auto;min-width:0}
        .plane{background:linear-gradient(180deg,var(--fleet-footer-canvas,transparent) 0%,var(--fleet-footer-canvas,transparent) 51%,var(--fleet-footer-lower,var(--fleet-footer-canvas,transparent)) 82%)}
        .middle{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(0,1fr);gap:clamp(2rem,6vw,5.5rem);align-items:start;padding-block:2.25rem 4.8rem;position:relative;z-index:2}
        .product,.services,.navigation,.cta,.feedback,.ai,.capture{min-width:0}.cta{margin-block-end:1.5rem}.feedback{margin-block-start:1.25rem}
        .capture{border-block-start:1px solid var(--fleet-footer-border);margin-block-start:1.5rem;padding-block-start:1.5rem}
        .capture-heading{font:600 1rem/1.35 var(--fleet-footer-ui-font);letter-spacing:-.015em;margin:0 0 .75rem}
        .service-status{font-size:.8rem;line-height:1.5;color:var(--fleet-footer-muted);margin:0}
        button{font:500 .8rem/1.4 var(--fleet-footer-ui-font);color:inherit;background:transparent;border:1px solid var(--fleet-footer-border);min-height:44px;padding:.5rem .8rem;margin-block-start:.6rem;cursor:pointer}
        button:focus-visible{outline:2px solid var(--fleet-footer-focus);outline-offset:4px}
        .terminal{position:relative;isolation:isolate;height:var(--fleet-footer-art-height,clamp(27rem,39vw,35rem));margin-block-start:-3.75rem;overflow:hidden;background:var(--fleet-footer-lower,var(--fleet-footer-canvas,transparent))}
        figure{position:absolute;inset:0;margin:0;z-index:-2}.art{display:block;width:100%;height:100%;max-width:none;object-fit:cover;object-position:50% 58%}
        .terminal::before{content:'';position:absolute;inset:0;z-index:-1;pointer-events:none;background:linear-gradient(180deg,var(--fleet-footer-lower,var(--fleet-footer-canvas,transparent)) 0%,color-mix(in srgb,var(--fleet-footer-lower,var(--fleet-footer-canvas,transparent)) 99%,transparent) 16%,color-mix(in srgb,var(--fleet-footer-lower,var(--fleet-footer-canvas,transparent)) 82%,transparent) 30%,color-mix(in srgb,var(--fleet-footer-lower,var(--fleet-footer-canvas,transparent)) 24%,transparent) 45%,transparent 57%)}
        .signature{padding-block-start:1rem;pointer-events:none}.wordmark{font:600 var(--fleet-footer-signature-size,clamp(3rem,10vw,8.25rem))/1.04 var(--fleet-footer-signature-font,var(--fleet-footer-ui-font));letter-spacing:-.045em;margin:0;max-width:100%;overflow-wrap:anywhere;font-optical-sizing:auto}
        .terminal[data-serif] .wordmark{font-family:var(--fleet-footer-signature-font,var(--fleet-footer-loaded-signature,Georgia,serif));font-size:var(--fleet-footer-signature-size,clamp(4.125rem,14vw,12.5rem));font-weight:400;line-height:1}
        .terminal[data-no-art]{height:auto!important;padding-block-end:2.5rem}.terminal[data-no-art]::before{display:none}
        .art-fallback{margin:0;padding:2rem var(--fleet-footer-edge,3.5rem);position:absolute;inset-block-start:45%;color:var(--fleet-footer-muted);font-size:.875rem}
        .studio{background:var(--fleet-footer-canvas,transparent);padding-block:.5rem;min-width:0}.projects{min-width:0;width:100%}
        ::slotted(*){min-width:0;max-width:100%;font-family:var(--fleet-footer-ui-font)}::slotted([slot=projects]){display:block;width:100%;--portfolio-strip-ui-font:var(--fleet-footer-ui-font);--portfolio-strip-edge:var(--fleet-footer-edge,3.5rem)}
        :host([surface=app]) .middle{padding-block-start:1.5rem}:host([surface=app]) .cta{display:none}:host([surface=app]) .terminal{height:var(--fleet-footer-app-art-height,25.3rem)}:host([surface=app]) .wordmark{font-size:var(--fleet-footer-app-signature-size,3.75rem)}:host([surface=app]) .terminal[data-serif] .wordmark{font-size:var(--fleet-footer-app-signature-size,4.75rem)}
        @media(max-width:1050px){.frame{width:calc(100% - 4rem)}.middle{gap:2.8rem}::slotted([slot=projects]){--portfolio-strip-edge:2rem}}
        @media(max-width:760px){.frame{width:calc(100% - 2.5rem)}.middle{grid-template-columns:minmax(0,1fr);gap:2rem;padding-block-start:1.6rem}.terminal{height:var(--fleet-footer-mobile-art-height,23.75rem)}.wordmark{font-size:var(--fleet-footer-mobile-signature-size,3.25rem)}.terminal[data-serif] .wordmark{font-size:var(--fleet-footer-mobile-signature-size,6.125rem)}::slotted([slot=projects]){--portfolio-strip-edge:1.25rem}:host([surface=app]) .terminal{height:var(--fleet-footer-app-mobile-art-height,20.3rem)}:host([surface=app]) .wordmark{font-size:var(--fleet-footer-app-mobile-signature-size,2.6875rem)}:host([surface=app]) .terminal[data-serif] .wordmark{font-size:var(--fleet-footer-app-mobile-signature-size,4.125rem)}}
        @media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
      `;
      const make = (tag, className, part) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (part) node.setAttribute('part', part);
        return node;
      };
      const makeSlot = (name) => {
        const slot = make('slot');
        slot.name = name;
        slot.addEventListener('slotchange', () => this.update());
        return slot;
      };
      const region = make('section', 'precise', 'root');
      region.setAttribute('aria-label', 'Product help, updates and studio');
      const plane = make('div', 'plane', 'plane');
      const middle = make('div', 'frame middle', 'middle');
      const product = make('div', 'product', 'product');
      const cta = make('div', 'cta', 'cta');
      cta.append(makeSlot('cta'));
      const navigation = make('div', 'navigation', 'navigation');
      navigation.append(makeSlot('navigation'));
      const feedback = make('div', 'feedback', 'feedback');
      feedback.append(makeSlot('feedback'));
      product.append(cta, navigation, feedback);
      const services = make('div', 'services', 'services');
      const ai = make('section', 'ai', 'ai');
      ai.setAttribute('aria-label', 'Ask AI');
      ai.append(makeSlot('ai'));
      const capture = make('section', 'capture', 'capture');
      capture.setAttribute('aria-label', 'Product updates');
      const heading = make('h2', 'capture-heading');
      heading.textContent = 'Product updates';
      const status = make('p', 'service-status', 'capture-status');
      status.setAttribute('role', 'status');
      const retry = make('button', 'retry', 'capture-retry');
      retry.type = 'button';
      retry.textContent = 'Try again';
      retry.addEventListener('click', () =>
        this.dispatchEvent(new CustomEvent('capture-retry', { bubbles: true, composed: true }))
      );
      capture.append(heading, makeSlot('capture'), status, retry);
      services.append(ai, capture);
      middle.append(product, services);
      plane.append(middle);
      const terminal = make('section', 'terminal', 'art-stage');
      terminal.setAttribute('aria-label', 'Product illustration and signature');
      const signature = make('div', 'frame signature', 'signature');
      const wordmark = make('h2', 'wordmark', 'wordmark');
      signature.append(wordmark);
      const figure = make('figure');
      const image = make('img', 'art', 'art');
      image.alt = '';
      image.loading = 'lazy';
      image.decoding = 'async';
      const fallback = make('p', 'art-fallback', 'art-fallback');
      fallback.textContent = 'Illustration unavailable.';
      fallback.hidden = true;
      image.addEventListener('error', () => {
        image.hidden = true;
        fallback.hidden = false;
      });
      image.addEventListener('load', () => {
        image.hidden = false;
        fallback.hidden = true;
      });
      figure.append(image);
      terminal.append(signature, figure, fallback);
      const studio = make('aside', 'studio', 'studio');
      studio.setAttribute('aria-label', 'Other projects from the studio');
      const projects = make('div', 'projects', 'projects');
      projects.append(makeSlot('projects'));
      studio.append(projects);
      // Studio child owns its one caption/three links/All projects. No duplicated frame copy.
      region.append(plane, terminal, studio);
      root.append(style, region);
      const nativeStyle = make('style');
      nativeStyle.dataset.fleetFooterNativeStyles = 'precise';
      nativeStyle.textContent = `
        fleet-footer-extension > [slot="navigation"],fleet-footer-extension > [slot="cta"],fleet-footer-extension > [slot="feedback"]{font-family:var(--fleet-footer-ui-font,var(--fleet-footer-loaded-ui,system-ui,sans-serif))}
        fleet-footer-extension > [slot="navigation"] a,fleet-footer-extension > [slot="navigation"] summary{font-family:var(--fleet-footer-ui-font,var(--fleet-footer-loaded-ui,system-ui,sans-serif));font-size:14px;line-height:1.45;min-height:44px;display:inline-flex;align-items:center}
        fleet-footer-extension > [slot="navigation"] :is(h2,h3,h4,[data-fleet-footer-group-label]){font-family:var(--fleet-footer-label-font,var(--fleet-footer-loaded-mono,ui-monospace,monospace));font-size:12px;font-weight:400;line-height:1.5;letter-spacing:.07em}
        fleet-footer-extension > [slot="navigation"] [data-fleet-footer-primary]{font-size:15px;font-weight:500}
        fleet-footer-extension > [slot="navigation"] [data-fleet-footer-legal]{font-size:12px}
        fleet-footer-extension > [slot="feedback"] button{font-family:var(--fleet-footer-ui-font,var(--fleet-footer-loaded-ui,system-ui,sans-serif));font-weight:500;min-height:44px}
      `;
      this.append(nativeStyle);
    }
    update() {
      const root = this.shadowRoot;
      if (!root) return;
      const assigned = (name) =>
        root.querySelector(`slot[name="${name}"]`).assignedElements().length > 0;
      const base =
        this.getAttribute('fonts') === 'false'
          ? null
          : safeFontBase(this.getAttribute('font-base'));
      if (base) {
        const families = fontRegistry(base);
        for (const [role, family] of Object.entries(families))
          this.style.setProperty(
            `--fleet-footer-loaded-${role}`,
            `"${family}",${role === 'mono' ? 'ui-monospace,monospace' : role === 'signature' ? 'Georgia,serif' : 'system-ui,sans-serif'}`
          );
      } else
        for (const role of ['ui', 'mono', 'signature'])
          this.style.removeProperty(`--fleet-footer-loaded-${role}`);
      const name = this.getAttribute('product-name') || 'this product';
      const isAtlas = /^(atlas|ph catalog)$/i.test(name);
      root.querySelector('.wordmark').textContent =
        this.getAttribute('signature-name') || (isAtlas ? 'Atlas' : name);
      const signatureFont = this.getAttribute('signature-font');
      root
        .querySelector('.terminal')
        .toggleAttribute(
          'data-serif',
          signatureFont === 'newsreader' || (!signatureFont && isAtlas)
        );
      if (signatureFont === 'inherit') root.querySelector('.wordmark').style.fontFamily = 'inherit';
      else root.querySelector('.wordmark').style.removeProperty('font-family');
      let url;
      const raw = this.getAttribute('art-src');
      try {
        const parsed = new URL(raw || '', window.location.href);
        if (
          raw &&
          !parsed.username &&
          !parsed.password &&
          ['http:', 'https:'].includes(parsed.protocol)
        )
          url = parsed.href;
      } catch {}
      const image = root.querySelector('.art');
      root.querySelector('figure').hidden = !url;
      root.querySelector('.art-fallback').hidden = !url || !image.hidden;
      if (url && image.getAttribute('src') !== url) {
        image.hidden = false;
        root.querySelector('.art-fallback').hidden = true;
        image.src = url;
      }
      if (!url) image.removeAttribute('src');
      image.alt = this.getAttribute('art-alt') || '';
      for (const [attr, fallback] of [
        ['width', 2172],
        ['height', 724],
      ]) {
        const number = Number(this.getAttribute(`art-${attr}`));
        image.setAttribute(
          attr,
          String(Number.isSafeInteger(number) && number > 0 && number <= 4096 ? number : fallback)
        );
      }
      const position = this.getAttribute('art-position') || '50% 58%';
      image.style.objectPosition =
        /^\d{1,3}(\.\d+)?% \d{1,3}(\.\d+)?%$/.test(position) &&
        position.split(' ').every((value) => parseFloat(value) <= 100)
          ? position
          : '50% 58%';
      root.querySelector('.terminal').toggleAttribute('data-no-art', !url);
      // Credit stays accessible metadata; no tiny overlay caption on busy artwork.
      const credit = this.getAttribute('art-credit');
      if (credit) image.setAttribute('title', credit);
      else image.removeAttribute('title');
      for (const slot of ['cta', 'navigation', 'feedback', 'ai'])
        root.querySelector(`.${slot}`).hidden = !assigned(slot);
      root.querySelector('.product').hidden = !['cta', 'navigation', 'feedback'].some(assigned);
      const hasCapture = assigned('capture');
      const enabled = this.getAttribute('show-updates') === 'true';
      root.querySelector('.capture').hidden = !hasCapture && !enabled;
      root.querySelector('.capture-heading').hidden = hasCapture;
      const status = root.querySelector('.service-status');
      const unavailable = this.getAttribute('capture-status') === 'unavailable';
      status.hidden = hasCapture || !enabled;
      status.textContent = unavailable
        ? 'Signup is unavailable right now.'
        : 'Getting the signup form…';
      root.querySelector('.retry').hidden = hasCapture || !enabled || !unavailable;
      root.querySelector('.services').hidden = !assigned('ai') && !hasCapture && !enabled;
      root.querySelector('.studio').hidden = !assigned('projects');
    }
  }
  customElements.define('fleet-footer-extension', FleetFooterExtension);
}
