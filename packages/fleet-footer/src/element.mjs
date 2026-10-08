/** Pure Art terrace composition. Hosts retain links, forms, state and API ownership. */
export function registerFleetFooter() {
  if (typeof window === 'undefined' || customElements.get('fleet-footer-extension')) return;
  class FleetFooterExtension extends HTMLElement {
    static observedAttributes = [
      'product-name',
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
      if (!this.shadowRoot) this.build();
      this.update();
      queueMicrotask(() => {
        if (this.isConnected)
          this.dispatchEvent(new CustomEvent('footer-connect', { bubbles: true, composed: true }));
      });
    }
    attributeChangedCallback() {
      if (this.shadowRoot) this.update();
    }
    build() {
      const root = this.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = `
        :host { --fleet-footer-border:color-mix(in srgb,currentColor 18%,transparent); --fleet-footer-muted:color-mix(in srgb,currentColor 78%,transparent); --fleet-footer-focus:currentColor; display:block;width:100%;min-width:0;color:inherit;font:inherit;border-block-start:1px solid var(--fleet-footer-border); }
        :host([theme=dark]) {color-scheme:dark} :host([theme=light]) {color-scheme:light}
        * {box-sizing:border-box} [hidden] {display:none!important}
        .terrace {max-width:var(--fleet-footer-max-width,74rem);padding:clamp(2rem,4vw,4rem) var(--fleet-footer-edge,1.25rem) 0;margin-inline:auto;min-width:0}
        figure {position:relative;margin:0 0 2rem;background:var(--fleet-footer-art-surface,color-mix(in srgb,currentColor 4%,transparent));overflow:hidden}
        .art {display:block;width:100%;height:auto;aspect-ratio:3/1;object-fit:contain;object-position:var(--fleet-footer-art-position,50% 50%)}
        .art-fallback {padding:2rem;margin:0;color:var(--fleet-footer-muted);font-size:.875rem}
        figcaption {position:absolute;inset-inline-start:.75rem;inset-block-end:.75rem;padding:.3rem .5rem;font-size:.65rem;line-height:1.4;background:var(--fleet-footer-caption-background,#f7f4ec);color:var(--fleet-footer-caption-color,#173b2d)}
        .cta {min-width:0;margin-block-end:1.75rem}.services {display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-block:1px solid var(--fleet-footer-border);margin-block-end:0}
        details {padding:1.25rem 1.5rem;min-width:0;border-inline-start:1px solid var(--fleet-footer-border)}details[data-first-visible]{padding-inline-start:0;border-inline-start:0}details[data-last-visible]{padding-inline-end:0}
        summary {display:flex;align-items:center;justify-content:space-between;gap:1rem;list-style:none;cursor:pointer;min-height:2.75rem}
        summary::-webkit-details-marker{display:none}summary strong{display:block;font-size:1rem;font-weight:600;line-height:1.3}summary small{display:block;font-size:.75rem;line-height:1.5;margin-block-start:.25rem;color:var(--fleet-footer-muted)}
        summary:focus-visible,a:focus-visible,button:focus-visible{outline:2px solid var(--fleet-footer-focus);outline-offset:4px}.plus{font-size:1.5rem;font-weight:300}details[open] .plus{transform:rotate(45deg)}
        .service-body{padding-block:1.25rem .25rem;min-width:0}.retry{display:inline-flex;align-items:center;min-height:2.75rem;margin-block-start:.5rem;padding:.5rem .8rem;background:transparent;color:inherit;border:1px solid var(--fleet-footer-border);font:inherit;font-size:.8rem;cursor:pointer}.service-status{font-size:.8rem;line-height:1.5;color:var(--fleet-footer-muted);margin:0}
        .studio {display:grid;grid-template-columns:minmax(0,.85fr) minmax(0,2.15fr);gap:2rem;padding-block:2rem;min-width:0}.studio h2{font-family:var(--fleet-footer-display-font,inherit);font-size:1.5rem;line-height:1.2;font-weight:500;letter-spacing:-.025em;margin:0 0 .8rem}.studio p{font-size:.8rem;line-height:1.5;color:var(--fleet-footer-muted);max-width:16rem;margin:0 0 .6rem}.studio a{display:inline-flex;align-items:center;min-height:2.75rem;color:inherit;font-size:.75rem;text-underline-offset:.25em}.projects{min-width:0}
        .navigation {border-block-start:1px solid var(--fleet-footer-border);padding-block:1.5rem;min-width:0}::slotted(*){min-width:0;max-width:100%}
        :host([surface=app]) .terrace{padding-block-start:1.5rem}:host([surface=app]) .art{aspect-ratio:6/1;object-fit:cover}:host([surface=app]) .cta{display:none}:host([surface=app]) details{padding-block:.9rem}:host([surface=app]) .studio{padding-block:1.5rem}
        @media(max-width:760px){.terrace{padding-block-start:2rem}.art{aspect-ratio:3/2;object-fit:cover}figure{margin-block-end:1.5rem}.services{grid-template-columns:minmax(0,1fr)!important}details,details[data-first-visible],details[data-last-visible]{padding:1rem 0;border-inline-start:0;border-block-start:1px solid var(--fleet-footer-border)}details[data-first-visible]{border-block-start:0}.studio{grid-template-columns:minmax(0,1fr);gap:1rem;padding-block:1.5rem}.studio p{max-width:none}summary strong{font-size:.95rem}.navigation{padding-block:1.25rem}:host([surface=app]) .art{aspect-ratio:3/1;object-fit:contain}}
        @media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
      `;
      const region = document.createElement('section');
      region.className = 'terrace';
      region.setAttribute('aria-label', 'Product help, updates and studio');
      const figure = document.createElement('figure');
      const image = document.createElement('img');
      image.className = 'art';
      image.alt = '';
      image.loading = 'lazy';
      image.decoding = 'async';
      const fallback = document.createElement('p');
      fallback.className = 'art-fallback';
      fallback.textContent = 'Illustration unavailable.';
      fallback.hidden = true;
      const caption = document.createElement('figcaption');
      image.addEventListener('error', () => {
        image.hidden = true;
        caption.hidden = true;
        fallback.hidden = false;
      });
      image.addEventListener('load', () => {
        image.hidden = false;
        fallback.hidden = true;
        caption.hidden = !caption.textContent;
      });
      figure.append(image, caption, fallback);
      const makeSlot = (name) => {
        const slot = document.createElement('slot');
        slot.name = name;
        slot.addEventListener('slotchange', () => this.update());
        return slot;
      };
      const cta = document.createElement('div');
      cta.className = 'cta';
      cta.append(makeSlot('cta'));
      const services = document.createElement('div');
      services.className = 'services';
      const definitions = [
        ['ai', 'Ask AI', 'Open a question in your assistant'],
        ['capture', 'Product updates', 'Opt in to news from this product'],
        ['feedback', 'Feedback & support', 'Found something? Tell us.'],
      ];
      for (const [name, title, description] of definitions) {
        const detail = document.createElement('details');
        detail.dataset.service = name;
        const summary = document.createElement('summary');
        const copy = document.createElement('span');
        const heading = document.createElement('strong');
        heading.textContent = title;
        const subtitle = document.createElement('small');
        subtitle.textContent = description;
        const plus = document.createElement('span');
        plus.className = 'plus';
        plus.textContent = '+';
        plus.setAttribute('aria-hidden', 'true');
        copy.append(heading, subtitle);
        summary.append(copy, plus);
        const content = document.createElement('div');
        content.className = 'service-body';
        const status = document.createElement('p');
        status.className = 'service-status';
        status.setAttribute('role', 'status');
        status.hidden = true;
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'retry';
        retry.textContent = 'Try again';
        retry.hidden = true;
        retry.addEventListener('click', () =>
          this.dispatchEvent(new CustomEvent('capture-retry', { bubbles: true, composed: true }))
        );
        content.append(makeSlot(name), status, retry);
        detail.append(summary, content);
        services.append(detail);
        detail.addEventListener('toggle', () => {
          if (detail.open)
            for (const other of services.querySelectorAll('details'))
              if (other !== detail) other.open = false;
        });
      }
      const studio = document.createElement('section');
      studio.className = 'studio';
      studio.setAttribute('aria-label', 'More from the studio');
      const studioCopy = document.createElement('div');
      const studioTitle = document.createElement('h2');
      studioTitle.textContent = 'More from the studio';
      const studioDescription = document.createElement('p');
      studioDescription.textContent = 'Independent tools for things we care about.';
      const all = document.createElement('a');
      all.href = 'https://sassmaker.com/projects';
      all.textContent = 'View all projects ↗';
      studioCopy.append(studioTitle, studioDescription, all);
      const projects = document.createElement('div');
      projects.className = 'projects';
      projects.append(makeSlot('projects'));
      studio.append(studioCopy, projects);
      const navigation = document.createElement('div');
      navigation.className = 'navigation';
      navigation.append(makeSlot('navigation'));
      region.append(figure, cta, services, studio, navigation);
      root.append(style, region);
    }
    update() {
      const root = this.shadowRoot;
      if (!root) return;
      const assigned = (name) =>
        root.querySelector(`slot[name="${name}"]`).assignedElements().length > 0;
      const raw = this.getAttribute('art-src');
      const image = root.querySelector('.art');
      let url;
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
      root.querySelector('figure').hidden = !url;
      if (url && image.getAttribute('src') !== url) {
        image.hidden = false;
        root.querySelector('.art-fallback').hidden = true;
        image.src = url;
      }
      image.alt = this.getAttribute('art-alt') || '';
      for (const [attr, fallback] of [
        ['width', 2048],
        ['height', 683],
      ]) {
        const number = Number(this.getAttribute(`art-${attr}`));
        image.setAttribute(
          attr,
          String(Number.isSafeInteger(number) && number > 0 && number <= 4096 ? number : fallback)
        );
      }
      const position = this.getAttribute('art-position') || '50% 50%';
      const validPosition =
        /^\d{1,3}(\.\d+)?% \d{1,3}(\.\d+)?%$/.test(position) &&
        position.split(' ').every((value) => parseFloat(value) <= 100);
      image.style.objectPosition = validPosition ? position : '50% 50%';
      const caption = root.querySelector('figcaption');
      caption.textContent = this.getAttribute('art-credit') || '';
      caption.hidden = !caption.textContent || image.hidden;
      root.querySelector('.cta').hidden = !assigned('cta');
      root.querySelector('.navigation').hidden = !assigned('navigation');
      root.querySelector('.studio').hidden = !assigned('projects');
      const name = this.getAttribute('product-name') || 'this product';
      for (const detail of root.querySelectorAll('[data-service]')) {
        const service = detail.dataset.service;
        const hasChild = assigned(service);
        const enabled = service === 'capture' && this.getAttribute('show-updates') === 'true';
        detail.hidden = !hasChild && !enabled;
        if (service === 'ai') detail.querySelector('strong').textContent = `Ask AI about ${name}`;
        if (service === 'capture') {
          detail.querySelector('small').textContent = `Opt in to news from ${name}`;
          const status = detail.querySelector('.service-status');
          status.hidden = hasChild;
          const unavailable = this.getAttribute('capture-status') === 'unavailable';
          status.textContent = unavailable
            ? 'Signup is unavailable right now.'
            : 'Getting the signup form…';
          detail.querySelector('.retry').hidden = hasChild || !enabled || !unavailable;
        }
      }
      const visible = Array.from(root.querySelectorAll('[data-service]')).filter((d) => !d.hidden);
      for (const detail of root.querySelectorAll('[data-service]')) {
        detail.toggleAttribute('data-first-visible', detail === visible[0]);
        detail.toggleAttribute('data-last-visible', detail === visible.at(-1));
      }
      root.querySelector('.services').style.gridTemplateColumns =
        visible.length > 0 ? `repeat(${visible.length},minmax(0,1fr))` : '';
      root.querySelector('.services').hidden = visible.length === 0;
    }
  }
  customElements.define('fleet-footer-extension', FleetFooterExtension);
}
