import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

// Exercise the actual serialized loader body without network or DOM rendering.
const loader = readFileSync(
  new URL('../../apps/showcase/src/pages/ai-chat-footer.js.ts', import.meta.url),
  'utf8'
);
const captureBody = loader.slice(
  loader.indexOf('const mountCapture = async'),
  loader.indexOf('  const mountFeedback =')
);

function harness({
  disabled = false,
  native = true,
  ok = true,
  lateNative = false,
  kind = 'newsletter',
} = {}) {
  const attributes = new Map<string, string>();
  const children: unknown[] = [];
  const extension = {
    dataset: {} as Record<string, string>,
    isConnected: true,
    setAttribute: (key: string, value: string) => attributes.set(key, value),
    getAttribute: (key: string) => attributes.get(key) ?? null,
    append: (child: unknown) => children.push(child),
  };
  const nativeCapture = { email: 'reader@example.test', consent: false, projectKey: 'pk_native' };
  let hasNative = native;
  let registered = !lateNative;
  const feedback = vi.fn();
  const fetch = vi
    .fn()
    .mockResolvedValue({ ok, json: async () => ({ api_key: 'pk_config', name: 'Product' }) });
  const document = {
    querySelector: () => (hasNative ? nativeCapture : null),
    createElement: () => ({ remove: vi.fn(), onload: () => {} }),
    head: {
      append: (script: { onload: () => void }) => {
        if (!ok) {
          (script as unknown as { onerror: () => void }).onerror();
          return;
        }
        registered = true;
        hasNative = true;
        script.onload();
      },
    },
  };
  const context = vm.createContext({
    script: { dataset: { capture: disabled ? 'false' : undefined } },
    AUTO_CAPTURE_KINDS: kind ? { product: kind } : {},
    captureModuleAttempts: new WeakMap(),
    assetBase: new URL('https://sassmaker.com/'),
    customElements: { get: () => registered },
    window: { setTimeout, clearTimeout },
    AbortController,
    URL,
    document,
    fetch,
    mountFeedback: feedback,
  });
  vm.runInContext(`${captureBody}\nglobalThis.invokeCapture = mountCapture;`, context);
  const mount = () => context.invokeCapture(extension, { getAttribute: () => 'product' });
  return { mount, attributes, children, extension, nativeCapture, feedback, fetch };
}

describe('footer capture configuration state', () => {
  it('settles ready when a native capture already owns the form, without modifying or duplicating it', async () => {
    const h = harness();
    const nativeBefore = { ...h.nativeCapture };
    await h.mount();
    expect(h.attributes.get('capture-status')).toBe('ready');
    expect(h.attributes.get('show-updates')).toBe('false');
    expect(h.extension.dataset.captureConfigured).toBe('true');
    expect(h.extension.dataset.capturePending).toBeUndefined();
    expect(h.children).toHaveLength(0);
    expect(h.nativeCapture).toEqual(nativeBefore);
    expect(h.feedback).toHaveBeenCalledOnce();
    await h.mount();
    expect(h.fetch).not.toHaveBeenCalled();
  });

  it('settles ready when capture is explicitly disabled while preserving configured feedback', async () => {
    const h = harness({ disabled: true, native: false });
    await h.mount();
    expect(h.attributes.get('capture-status')).toBe('ready');
    expect(h.attributes.get('show-updates')).toBe('false');
    expect(h.children).toHaveLength(0);
    expect(h.feedback).toHaveBeenCalledOnce();
  });

  it('settles ready for a product with no capture applicability', async () => {
    const h = harness({ native: false, kind: '' });
    await h.mount();
    expect(h.attributes.get('capture-status')).toBe('ready');
    expect(h.children).toHaveLength(0);
  });

  it('settles ready if a native form appears while the module is loading', async () => {
    const h = harness({ native: false, lateNative: true });
    await h.mount();
    expect(h.attributes.get('capture-status')).toBe('ready');
    expect(h.attributes.get('show-updates')).toBe('false');
    expect(h.children).toHaveLength(0);
  });

  it('keeps genuine configuration failure unavailable and retryable', async () => {
    const h = harness({ ok: false, native: false, lateNative: true });
    await h.mount();
    expect(h.attributes.get('capture-status')).toBe('unavailable');
    expect(h.extension.dataset.captureConfigured).toBeUndefined();
    expect(h.extension.dataset.capturePending).toBeUndefined();
    expect(h.children).toHaveLength(0);
    expect(h.feedback).toHaveBeenCalledOnce();
    expect(h.fetch).not.toHaveBeenCalled();
  });
});
