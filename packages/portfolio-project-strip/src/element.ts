import { DEFAULT_PROJECTS } from './catalog';
import { normalizeProjects, withReferralSource } from './core';
import type { PortfolioProject } from './types';

export const PORTFOLIO_PROJECT_STRIP_TAG = 'portfolio-project-strip';
export const DEFAULT_CATALOG_URL = 'https://sassmaker.com/projects.json';
const REQUEST_TIMEOUT_MS = 800;

export function registerPortfolioProjectStrip(): void {
  if (typeof window === 'undefined' || customElements.get(PORTFOLIO_PROJECT_STRIP_TAG)) return;

  class PortfolioProjectStripElement extends HTMLElement {
    projects: readonly PortfolioProject[] = DEFAULT_PROJECTS;

    static observedAttributes = [
      'current-project',
      'catalog-url',
      'label',
      'speed',
      'theme',
      'layout',
    ];

    connectedCallback() {
      this.render();
      void this.revalidate();
    }

    attributeChangedCallback() {
      if (this.isConnected) this.render();
    }

    render() {
      const currentProject = this.getAttribute('current-project') || undefined;
      const label = this.getAttribute('label') || 'Other projects by Sarthak';
      const parsedSpeed = Number(this.getAttribute('speed'));
      const speed =
        Number.isFinite(parsedSpeed) && parsedSpeed > 0 ? Math.max(20, parsedSpeed) : 42;
      const curated = this.getAttribute('layout') === 'curated';
      const eligibleProjects = normalizeProjects(this.projects).filter(
        (project) => project.id !== currentProject
      );
      const projects = curated ? eligibleProjects.slice(0, 3) : eligibleProjects;
      if (projects.length === 0) {
        this.hidden = true;
        return;
      }
      this.hidden = false;

      const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' });
      root.replaceChildren();
      const style = document.createElement('style');
      style.textContent = `
        :host {
          --portfolio-strip-bg: color-mix(in srgb, currentColor 3%, transparent);
          --portfolio-strip-text: currentColor;
          --portfolio-strip-muted: color-mix(in srgb, currentColor 70%, transparent);
          --portfolio-strip-border: color-mix(in srgb, currentColor 12%, transparent);
          --portfolio-strip-focus: #2563eb;
          display: block;
          width: 100%;
          min-width: 0;
          max-width: 100%;
          overflow: hidden;
          contain: inline-size;
          border-block: 1px solid var(--portfolio-strip-border);
          background: var(--portfolio-strip-bg);
          color: var(--portfolio-strip-text);
          font: inherit;
        }
        :host([theme='light']) { --portfolio-strip-bg: #fafaf9; --portfolio-strip-text: #292524; --portfolio-strip-muted: #6f6964; --portfolio-strip-border: #e7e5e4; }
        :host([theme='dark']) { --portfolio-strip-bg: #171717; --portfolio-strip-text: #f5f5f4; --portfolio-strip-muted: #a8a29e; --portfolio-strip-border: #30302f; }
        :host([integrated]) { border-block: 0; background: transparent; }
        * { box-sizing: border-box; }
        aside { width: 100%; min-width: 0; overflow: hidden; }
        .viewport { width: 100%; min-width: 0; overflow: hidden; padding: 0 1rem; mask-image: linear-gradient(90deg, transparent, currentColor 1rem, currentColor calc(100% - 1rem), transparent); }
        .track { display: flex; width: max-content; align-items: center; animation: portfolio-strip-marquee var(--portfolio-strip-speed) linear infinite; }
        .viewport:hover .track, .viewport:focus-within .track { animation-play-state: paused; }
        ul { display: flex; align-items: center; margin: 0; padding: 0; list-style: none; }
        li { display: inline-flex; align-items: center; white-space: nowrap; }
        a { display: inline-flex; min-height: 2.75rem; align-items: center; border-radius: .2rem; color: inherit; font-size: .8125rem; text-decoration: none; }
        a:hover { text-decoration: underline; text-underline-offset: .2em; }
        a:focus-visible { outline: 2px solid var(--portfolio-strip-focus); outline-offset: 2px; }
        .dot { padding: 0 .7rem; color: var(--portfolio-strip-muted); }
        :host([layout='curated']) { border-block: 0; background: transparent; container-type: inline-size; }
        .curated-list { display: grid; grid-template-columns: minmax(0, 1fr); gap: .75rem; padding: 0; }
        .curated-list li { display: block; white-space: normal; min-width: 0; }
        .curated-list a { font-size: .95rem; font-weight: 650; overflow-wrap: anywhere; }
        .description { margin: 0; color: var(--portfolio-strip-muted); font-size: .8125rem; line-height: 1.5; overflow-wrap: anywhere; }
        @container (min-width: 560px) { .curated-list { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1.5rem; align-items: start; } }
        @keyframes portfolio-strip-marquee { to { transform: translateX(-50%); } }
        @media (prefers-reduced-motion: reduce), (hover: none), (pointer: coarse) {
          .track { animation: none; }
          .viewport { overflow-x: auto; mask-image: none; }
          .duplicate { display: none; }
        }
      `;

      const aside = document.createElement('aside');
      aside.setAttribute('aria-label', label);
      if (curated) {
        const list = document.createElement('ul');
        list.className = 'curated-list';
        for (const project of projects) {
          const item = document.createElement('li');
          const link = document.createElement('a');
          link.href = withReferralSource(project.url, currentProject);
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.textContent = project.name;
          link.setAttribute('aria-label', `${project.name} (opens in a new tab)`);
          item.append(link);
          if (project.description) {
            const description = document.createElement('p');
            description.className = 'description';
            description.textContent = project.description;
            item.append(description);
          }
          list.append(item);
        }
        aside.append(list);
        root.append(style, aside);
        return;
      }

      const viewport = document.createElement('div');
      viewport.className = 'viewport';
      const track = document.createElement('div');
      track.className = 'track';
      track.style.setProperty('--portfolio-strip-speed', `${speed}s`);

      const createList = (duplicate: boolean) => {
        const list = document.createElement('ul');
        if (duplicate) {
          list.className = 'duplicate';
          list.setAttribute('aria-hidden', 'true');
        }
        for (const project of projects) {
          const item = document.createElement('li');
          const link = document.createElement('a');
          link.href = withReferralSource(project.url, currentProject);
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.textContent = project.name;
          link.title = project.description || project.name;
          link.setAttribute('aria-label', `${project.name} (opens in a new tab)`);
          if (duplicate) link.tabIndex = -1;
          const dot = document.createElement('span');
          dot.className = 'dot';
          dot.setAttribute('aria-hidden', 'true');
          dot.textContent = '·';
          item.append(link, dot);
          list.append(item);
        }
        return list;
      };

      track.append(createList(false), createList(true));
      viewport.append(track);
      aside.append(viewport);
      root.append(style, aside);
    }

    async revalidate() {
      const catalogUrl = this.getAttribute('catalog-url') ?? DEFAULT_CATALOG_URL;
      if (!catalogUrl) return;
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(catalogUrl, {
          signal: controller.signal,
          headers: { accept: 'application/json' },
          cache: 'force-cache',
        });
        if (!response.ok) return;
        const projects = normalizeProjects(await response.json());
        if (projects.length > 0) {
          this.projects = projects;
          this.render();
        }
      } catch {
        // Keep the bundled catalog on timeout or network failure.
      } finally {
        window.clearTimeout(timeout);
      }
    }
  }

  customElements.define(PORTFOLIO_PROJECT_STRIP_TAG, PortfolioProjectStripElement);
}

registerPortfolioProjectStrip();
