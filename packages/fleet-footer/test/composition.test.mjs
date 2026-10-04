import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { registerFleetFooter } from '../src/element.mjs';

// A narrow DOM double tests composition/state ownership, not rendering or font loading.
function environment() {
  class Node {
    constructor(tag = 'host') {
      this.tag = tag;
      this.children = [];
      this.attributes = new Map();
      this.dataset = {};
      this.listeners = new Map();
      this.hidden = false;
      this.isConnected = true;
      this.style = {
        values: new Map(),
        setProperty(key, value) {
          this.values.set(key, value);
        },
        removeProperty(key) {
          this.values.delete(key);
        },
      };
    }
    append(...nodes) {
      for (const node of nodes) {
        node.parent = this;
        this.children.push(node);
      }
    }
    setAttribute(key, value) {
      this.attributes.set(key, String(value));
    }
    getAttribute(key) {
      return this.attributes.get(key) ?? null;
    }
    removeAttribute(key) {
      this.attributes.delete(key);
    }
    toggleAttribute(key, enabled) {
      if (enabled) this.setAttribute(key, '');
      else this.removeAttribute(key);
    }
    addEventListener(name, listener) {
      this.listeners.set(name, listener);
    }
    dispatchEvent(event) {
      this.events ??= [];
      this.events.push(event);
      this.listeners.get(event.type)?.(event);
    }
    attachShadow() {
      this.shadowRoot = new Node('shadow');
      this.shadowRoot.owner = this;
      return this.shadowRoot;
    }
    assignedElements() {
      let node = this;
      while (!node.owner && node.parent) node = node.parent;
      return node.owner?.children.filter((child) => child.getAttribute('slot') === this.name) ?? [];
    }
    querySelector(selector) {
      const matches = (node) => {
        if (selector.startsWith('.')) return node.className?.split(' ').includes(selector.slice(1));
        const slot = selector.match(/^slot\[name="([^"]+)"\]$/);
        if (slot) return node.tag === 'slot' && node.name === slot[1];
        const fonts = selector.match(/^\[data-fleet-footer-fonts="([^"]+)"\]$/);
        if (fonts) return node.dataset.fleetFooterFonts === fonts[1];
        return node.tag === selector;
      };
      for (const child of this.children) {
        if (matches(child)) return child;
        const descendant = child.querySelector(selector);
        if (descendant) return descendant;
      }
      return null;
    }
    set src(value) {
      this.setAttribute('src', value);
    }
  }
  const definitions = new Map();
  const document = { head: new Node('head'), createElement: (tag) => new Node(tag) };
  const context = vm.createContext({
    HTMLElement: Node,
    document,
    URL,
    window: {
      location: { href: 'https://product.example/page', origin: 'https://product.example' },
    },
    customElements: {
      get: (name) => definitions.get(name),
      define: (name, type) => definitions.set(name, type),
    },
    CustomEvent: class {
      constructor(type, options) {
        this.type = type;
        Object.assign(this, options);
      }
    },
    queueMicrotask,
  });
  vm.runInContext(`(${registerFleetFooter.toString()})();`, context);
  const Host = definitions.get('fleet-footer-extension');
  return { Host, Node, document, context, definitions };
}

test('concrete native canvas defaults honor theme and bounded opaque ancestor color', () => {
  const { Host, Node, context } = environment();
  const light = new Host();
  light.connectedCallback();
  assert.equal(light.style.values.get('--fleet-footer-native-canvas'), '#fafaf9');
  const dark = new Host();
  dark.setAttribute('theme', 'dark');
  dark.connectedCallback();
  assert.equal(dark.style.values.get('--fleet-footer-native-canvas'), '#171717');
  let inspected = 0;
  context.window.getComputedStyle = (node) => {
    inspected++;
    return { backgroundColor: node.color ?? 'rgba(0, 0, 0, 0)' };
  };
  const parent = new Node();
  parent.color = 'rgb(241, 240, 233)';
  const native = new Host();
  native.parentElement = parent;
  native.connectedCallback();
  assert.equal(native.style.values.get('--fleet-footer-native-canvas'), parent.color);
  assert.equal(inspected, 2);
  inspected = 0;
  const deep = new Host();
  let cursor = deep;
  for (let index = 0; index < 12; index++) {
    cursor.parentElement = new Node();
    cursor = cursor.parentElement;
  }
  cursor.color = 'rgb(1, 2, 3)';
  deep.connectedCallback();
  assert.equal(inspected, 8);
  assert.equal(deep.style.values.get('--fleet-footer-native-canvas'), '#fafaf9');
});

test('serialized registration has no free bindings and reconnect retains original controls', () => {
  const { Host, Node, context, definitions } = environment();
  const host = new Host();
  const original = ['navigation', 'feedback', 'ai', 'capture', 'projects'].map((slot) => {
    const node = new Node(slot);
    node.setAttribute('slot', slot);
    host.append(node);
    return node;
  });
  original[2].value = 'My edited question';
  original[3].email = 'kept@example.com';
  original[3].consent = true;
  host.connectedCallback();
  const shadow = host.shadowRoot;
  host.setAttribute('product-name', 'PH Catalog');
  host.update();
  host.connectedCallback();
  assert.equal(host.shadowRoot, shadow);
  assert.deepEqual(host.children.slice(0, 5), original);
  assert.equal(host.children.length, 6, 'only one scoped native stylesheet, no rebuilt children');
  assert.equal(original[2].value, 'My edited question');
  assert.equal(original[3].email, 'kept@example.com');
  assert.equal(original[3].consent, true);
  assert.equal(shadow.querySelector('.capture').hidden, false);
  assert.equal(shadow.querySelector('.wordmark').textContent, 'Atlas');
  const region = shadow.querySelector('.precise');
  assert.deepEqual(
    region.children.map((node) => node.className),
    ['plane', 'terminal', 'studio']
  );
  assert.equal(shadow.querySelector('details'), null, 'form is not behind a disclosure');
  vm.runInContext(`(${registerFleetFooter.toString()})();`, context);
  assert.equal(definitions.get('fleet-footer-extension'), Host);
});

test('capture configuration states and retry remain explicit without changing child state', () => {
  const { Host, Node } = environment();
  const host = new Host();
  host.setAttribute('show-updates', 'true');
  host.connectedCallback();
  const root = host.shadowRoot;
  assert.equal(root.querySelector('.capture').hidden, false);
  assert.equal(root.querySelector('.service-status').textContent, 'Getting the signup form…');
  assert.equal(root.querySelector('.retry').hidden, true);
  host.setAttribute('capture-status', 'unavailable');
  host.update();
  assert.equal(
    root.querySelector('.service-status').textContent,
    'Signup is unavailable right now.'
  );
  assert.equal(root.querySelector('.retry').hidden, false);
  root.querySelector('.retry').dispatchEvent({ type: 'click' });
  assert.equal(host.events.at(-1).type, 'capture-retry');
  assert.equal(host.events.at(-1).composed, true);
  const form = new Node('capture');
  form.setAttribute('slot', 'capture');
  host.append(form);
  host.update();
  assert.equal(root.querySelector('.service-status').hidden, true);
  assert.equal(root.querySelector('.retry').hidden, true);
  assert.equal(root.querySelector('.capture').hidden, false);
  host.setAttribute('show-updates', 'false');
  host.update();
  assert.equal(
    root.querySelector('.capture').hidden,
    false,
    'actual child remains visible regardless of automatic configuration'
  );
});

test('art errors recover while invalid URLs/fonts fail closed and studio stays last', () => {
  const { Host, document } = environment();
  const host = new Host();
  host.setAttribute('art-src', '/footer-art/product.webp');
  host.connectedCallback();
  const root = host.shadowRoot;
  const image = root.querySelector('.art');
  assert.equal(image.getAttribute('src'), 'https://product.example/footer-art/product.webp');
  image.dispatchEvent({ type: 'error' });
  host.update();
  assert.equal(root.querySelector('.art-fallback').hidden, false);
  host.setAttribute('art-src', '/footer-art/other.webp');
  host.update();
  assert.equal(image.hidden, false);
  assert.equal(root.querySelector('.art-fallback').hidden, true);
  image.dispatchEvent({ type: 'load' });
  host.setAttribute('art-src', 'javascript:alert(1)');
  host.update();
  assert.equal(root.querySelector('figure').hidden, true);
  assert.equal(image.getAttribute('src'), null);
  assert.equal(root.querySelector('.terminal').getAttribute('data-no-art'), '');
  const fontCount = document.head.children.length;
  for (const base of [
    'https://untrusted.example/fonts/',
    'https://user:pass@sassmaker.com/fonts/',
    'data:text/css,x',
  ]) {
    host.setAttribute('font-base', base);
    host.update();
    assert.equal(document.head.children.length, fontCount);
    assert.equal(host.style.values.has('--fleet-footer-loaded-ui'), false);
  }
  host.setAttribute('font-base', '/local-fonts/');
  host.update();
  assert.equal(document.head.children.length, fontCount + 1);
  host.update();
  assert.equal(
    document.head.children.length,
    fontCount + 1,
    'font registrations are shared per safe base'
  );
  assert.match(
    document.head.children.at(-1).textContent,
    /https:\/\/product.example\/local-fonts\/geist\.woff2/
  );
});
