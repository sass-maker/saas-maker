import assert from 'node:assert/strict';
import test from 'node:test';
import { registerPortfolioProjectStrip } from '../dist/browser/element.mjs';

class FixtureNode {
  constructor(tag = '') {
    this.tagName = tag;
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.isConnected = false;
    this.bounds = { left: 0, right: 100 };
    this.style = {
      setProperty(name, value) {
        this[name] = value;
      },
      removeProperty(name) {
        delete this[name];
      },
    };
  }
  append(...nodes) {
    for (const node of nodes) {
      node.parent = this;
      this.children.push(node);
    }
  }
  replaceChildren(...nodes) {
    this.children = [];
    this.activeElement = null;
    this.append(...nodes);
  }
  attachShadow() {
    this.shadowRoot = new FixtureNode();
    return this.shadowRoot;
  }
  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }
  setAttribute(name, value) {
    const previous = this.getAttribute(name);
    this.attributes.set(name, String(value));
    if (this.constructor.observedAttributes?.includes(name)) {
      this.attributeChangedCallback(name, previous, String(value));
    }
  }
  querySelectorAll(selector) {
    return this.children.flatMap((child) => [
      ...((
        selector.startsWith('.')
          ? child.className === selector.slice(1)
          : child.tagName === selector
      )
        ? [child]
        : []),
      ...child.querySelectorAll(selector),
    ]);
  }
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }
  contains(node) {
    return node === this || this.children.some((child) => child.contains(node));
  }
  focus() {
    let root = this;
    while (root.parent) root = root.parent;
    root.activeElement = this;
  }
  getBoundingClientRect() {
    return this.bounds;
  }
  addEventListener(type, listener) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  emit(type, event = {}) {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

async function withBrowser(run) {
  const names = [
    'window',
    'document',
    'HTMLElement',
    'HTMLAnchorElement',
    'Node',
    'customElements',
    'fetch',
    'getComputedStyle',
  ];
  const previous = new Map(names.map((name) => [name, globalThis[name]]));
  const definitions = new Map();
  globalThis.window = { setTimeout, clearTimeout };
  globalThis.HTMLElement = FixtureNode;
  globalThis.HTMLAnchorElement = FixtureNode;
  globalThis.Node = FixtureNode;
  globalThis.document = { createElement: (tag) => new FixtureNode(tag) };
  globalThis.getComputedStyle = () => ({ transform: 'matrix(1, 0, 0, 1, -40, 0)' });
  globalThis.customElements = {
    get: (name) => definitions.get(name),
    define: (name, definition) => definitions.set(name, definition),
  };
  try {
    registerPortfolioProjectStrip();
    await run(definitions.get('portfolio-project-strip'));
  } finally {
    for (const name of names) {
      if (previous.get(name) === undefined) delete globalThis[name];
      else globalThis[name] = previous.get(name);
    }
  }
}

const projects = [
  { id: 'current', name: 'Current', url: 'https://current.example' },
  { id: 'one', name: 'One', url: 'https://one.example/path?campaign=launch#details' },
  { id: 'two', name: 'Two', url: 'https://two.example' },
  { id: 'three', name: 'Three', url: 'https://three.example' },
];

test('same-value attributes preserve studio nodes; successful refresh restores destination focus', async () => {
  await withBrowser(async (Strip) => {
    const strip = new Strip();
    strip.projects = projects;
    strip.setAttribute('layout', 'studio');
    strip.setAttribute('theme', 'dark');
    strip.setAttribute('current-project', 'current');
    strip.setAttribute('catalog-url', 'https://catalog.example/projects.json');
    strip.isConnected = true;
    strip.render();
    const root = strip.shadowRoot;
    const line = root.querySelector('.studio-line');
    const focused = line.querySelectorAll('a')[1];
    focused.focus();
    strip.setAttribute('theme', 'dark');
    strip.setAttribute('current-project', 'current');
    assert.equal(root.querySelector('.studio-line'), line);
    assert.equal(root.activeElement, focused);
    const requests = [];
    globalThis.fetch = async (url, options) => {
      requests.push({ url, options });
      return new Response(
        JSON.stringify([...projects, { id: 'bad', name: 'Unsafe', url: 'javascript:alert(1)' }])
      );
    };
    await strip.revalidate();
    assert.equal(requests[0].url, 'https://catalog.example/projects.json');
    assert.equal(requests[0].options.cache, 'no-cache');
    assert.equal(requests[0].options.headers.accept, 'application/json');
    const refreshed = root.querySelector('.studio-line');
    assert.notEqual(refreshed, line);
    assert.equal(refreshed.tabIndex, undefined);
    assert.equal(root.activeElement.href, focused.href);
    assert.match(root.activeElement.href, /ref=current/);
    assert.equal(refreshed.querySelectorAll('a').length, 4);
    globalThis.fetch = async () =>
      new Response(JSON.stringify(projects.filter((project) => project.id !== 'two')));
    await strip.revalidate();
    assert.equal(root.activeElement, root.querySelector('.studio-line').querySelectorAll('a')[0]);
  });
});

test('standalone browser marquee reveals keyboard destinations and resumes after focus leaves', async () => {
  await withBrowser(async (Strip) => {
    const strip = new Strip();
    strip.projects = projects;
    strip.setAttribute('current-project', 'current');
    strip.isConnected = true;
    strip.render();
    const root = strip.shadowRoot;
    const viewport = root.querySelector('.viewport');
    const track = root.querySelector('.track');
    const link = root.querySelectorAll('a')[1];
    viewport.bounds = { left: 0, right: 300 };
    link.bounds = { left: 350, right: 400 };
    link.emit('focus');
    assert.equal(track.style.animation, 'none');
    assert.equal(track.style.transform, 'translateX(-156px)');
    link.emit('blur', { relatedTarget: null });
    assert.equal(track.style.animation, undefined);
    assert.equal(track.style.transform, undefined);
  });
});
