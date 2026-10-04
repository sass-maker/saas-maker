import { describe, expect, it } from 'vitest';
import { classicBrowserBundle } from '../../apps/showcase/src/lib/classic-browser-bundle';

describe('classic browser entry adaptation', () => {
  it('retains registration while removing only a final export block', () => {
    const source = classicBrowserBundle('function register() {}\nregister();\nexport { register };\n');
    expect(source).toContain('register();');
    expect(() => new Function(source)).not.toThrow();
  });
  it('rejects imports and unsupported module exports instead of shipping broken classic scripts', () => {
    expect(() => classicBrowserBundle('import { x } from "remote";\nx();')).toThrow();
    expect(() => classicBrowserBundle('export default function register() {}')).toThrow();
  });
});
