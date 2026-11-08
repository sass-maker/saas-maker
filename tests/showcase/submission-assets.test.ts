import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import catalog from '../../catalog/generated/public.json';
import { buildSubmissionKits } from '../../scripts/submission-kits.mjs';
import type { DirectoryProject } from '../../apps/showcase/src/data/directory';

const kits = buildSubmissionKits(catalog.directory as DirectoryProject[]);
const publicRoot = resolve('apps/showcase/public');

describe('published submission asset files', () => {
  for (const kit of kits.filter((kit) => kit.assets.length > 0)) {
    it(`${kit.id} supplies a square PNG logo and matching downloadable image bytes`, () => {
      const pngLogo = kit.assets.find(
        (asset) => asset.kind === 'logo' && asset.mimeType === 'image/png'
      );
      expect(pngLogo, 'Directory uploads need a raster logo').toBeDefined();
      expect(pngLogo?.width).toBe(pngLogo?.height);
      expect(pngLogo?.width).toBeGreaterThanOrEqual(512);
      for (const asset of kit.assets) {
        if (!asset.url.startsWith('https://sassmaker.com/product-assets/')) continue;
        const bytes = readFileSync(resolve(publicRoot, new URL(asset.url).pathname.slice(1)));
        expect(bytes.byteLength, asset.url).toBe(asset.byteSize);
        if (asset.mimeType === 'image/png') {
          expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
          expect(bytes.readUInt32BE(16), asset.url).toBe(asset.width);
          expect(bytes.readUInt32BE(20), asset.url).toBe(asset.height);
        }
        if (asset.mimeType === 'image/svg+xml') expect(bytes.toString()).toContain('<svg');
      }
      for (const video of kit.assets.filter((asset) => asset.kind === 'video')) {
        const downloadUrl = new URL(video.url);
        if (downloadUrl.origin === 'https://assets.sassmaker.com') {
          expect(downloadUrl.search, 'The CDN attachment rule matches this exact query').toBe(
            '?download=1'
          );
          expect(video.viewUrl, 'Inline previews must use the bare video URL').toBe(
            `${downloadUrl.origin}${downloadUrl.pathname}`
          );
        }
        expect(video.posterUrl, 'Video downloads need an identifiable preview').toBeDefined();
        const poster = readFileSync(
          resolve(publicRoot, new URL(video.posterUrl!).pathname.slice(1))
        );
        expect(poster.subarray(0, 3).toString('hex')).toBe('ffd8ff');
      }
    });
  }
});
