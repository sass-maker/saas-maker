import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { registerAIChatFooter } from '../dist/browser/element.mjs';
import { AIChatFooter, DEFAULT_PROVIDERS } from '../dist/index.mjs';

test('question layout seeds a labelled real textarea and keeps semantic provider links', () => {
  const props = {
    companyName: 'Acme',
    companyUrl: 'https://acme.example',
    prompt: 'Can {companyName} handle A & B?',
  };
  const standard = renderToStaticMarkup(createElement(AIChatFooter, props));
  const question = renderToStaticMarkup(
    createElement(AIChatFooter, { ...props, layout: 'question' })
  );
  assert.doesNotMatch(standard, /<textarea/);
  assert.match(question, /data-layout="question"/);
  assert.match(question, /<label[^>]+for="[^"]+"/);
  assert.match(question, /Your question/);
  assert.match(question, /<textarea[^>]+maxLength="2000"/);
  assert.match(question, />Can Acme handle A &amp; B\?<\/textarea>/);
  assert.deepEqual(question.match(/href="[^"]+"/g), standard.match(/href="[^"]+"/g));
  assert.equal((question.match(/data-ai-provider=/g) ?? []).length, 5);
  assert.equal(
    (question.match(/title="(?:Claude|ChatGPT|Gemini|Perplexity|Grok)"/g) ?? []).length,
    5
  );
});

// Exercise the browser entrypoint's handlers without adding a DOM dependency.
class FixtureNode {
  constructor(tag = '') {
    this.tagName = tag;
    this.children = [];
    this.attributes = new Map();
    this.dataset = {};
    this.listeners = new Map();
    this.isConnected = false;
  }
  append(...nodes) {
    this.children.push(...nodes);
  }
  replaceChildren(...nodes) {
    this.children = nodes;
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
  addEventListener(type, listener) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  emit(type) {
    for (const listener of this.listeners.get(type) ?? []) listener();
  }
}

function descendants(node) {
  return node.children.flatMap((child) => [child, ...descendants(child)]);
}

test('browser question edits update every handoff and survive metadata changes and reconnect', () => {
  const names = ['window', 'document', 'HTMLElement', 'customElements'];
  const previous = new Map(names.map((name) => [name, globalThis[name]]));
  const definitions = new Map();
  globalThis.window = { location: { origin: 'https://acme.example' } };
  globalThis.HTMLElement = FixtureNode;
  globalThis.document = {
    createElement: (tag) => new FixtureNode(tag),
    createElementNS: (_namespace, tag) => new FixtureNode(tag),
  };
  globalThis.customElements = {
    get: (name) => definitions.get(name),
    define: (name, definition) => definitions.set(name, definition),
  };
  try {
    registerAIChatFooter();
    const Footer = definitions.get('ai-chat-footer');
    const footer = new Footer();
    footer.setAttribute('product-name', 'Acme');
    footer.setAttribute('prompt', 'Explain {companyName} at {companyUrl}.');
    footer.setAttribute('layout', 'question');
    footer.isConnected = true;
    footer.connectedCallback();
    let nodes = descendants(footer.shadowRoot);
    let input = nodes.find((node) => node.tagName === 'textarea');
    assert.equal(input.value, 'Explain Acme at https://acme.example.');
    const question = 'Can this handle A & B = 100%? #日本語';
    input.value = question;
    input.emit('input');
    const links = nodes.filter((node) => node.dataset.aiProvider);
    assert.deepEqual(
      links.map((link) => link.dataset.aiProvider),
      DEFAULT_PROVIDERS
    );
    for (const link of links) {
      const parameter = link.dataset.aiProvider === 'gemini' ? 'is_sa_p' : 'q';
      assert.equal(new URL(link.href).searchParams.get(parameter), question);
      assert.equal(link.target, '_blank');
      assert.equal(link.rel, 'noopener noreferrer');
      assert.match(link.getAttribute('aria-label'), /Acme \(opens in a new tab\)/);
    }
    footer.setAttribute('theme', 'dark');
    footer.setAttribute('label', 'Ask about Acme');
    footer.connectedCallback();
    nodes = descendants(footer.shadowRoot);
    input = nodes.find((node) => node.tagName === 'textarea');
    assert.equal(input.value, question);
    for (const link of nodes.filter((node) => node.dataset.aiProvider)) {
      const parameter = link.dataset.aiProvider === 'gemini' ? 'is_sa_p' : 'q';
      assert.equal(new URL(link.href).searchParams.get(parameter), question);
    }
    input.value = '';
    input.emit('input');
    footer.setAttribute('label', 'A different heading');
    assert.equal(
      descendants(footer.shadowRoot).find((node) => node.tagName === 'textarea').value,
      ''
    );
    footer.setAttribute('product-name', 'Other product');
    assert.equal(
      descendants(footer.shadowRoot).find((node) => node.tagName === 'textarea').value,
      'Explain Other product at https://acme.example.'
    );
  } finally {
    for (const name of names) {
      if (previous.get(name) === undefined) delete globalThis[name];
      else globalThis[name] = previous.get(name);
    }
  }
});
