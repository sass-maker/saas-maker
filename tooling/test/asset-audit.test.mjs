import assert from 'node:assert/strict';
import test from 'node:test';
import { auditAssets } from '../launchkit/scripts/audit-assets.mjs';

const publicProject = {
  id: 'example', name: 'Example', description: 'A product.', roster: 'current',
  availability: 'public-link', shareable: true, publicUrl: 'https://example.com',
  submission: { assets: [{ id: 'logo', kind: 'logo', label: 'Logo', filename: 'logo.png',
    mimeType: 'image/png', url: '/product-assets/example/logo.png', byteSize: 42 }] },
};
const privateProject = { id: 'private', name: 'Private', roster: 'current', shareable: false };
const catalog = { directory: [publicProject, privateProject] };

test('reports stale Drive links and changed local bytes without publishing private products', () => {
  const index = { products: [
    { id: 'example', driveFolderUrl: 'https://drive.google.com/drive/folders/example', assets: [
      { publicDownloadUrl: 'https://sassmaker.com/product-assets/example/old.png' },
    ] },
    { id: 'private', driveFolderUrl: 'https://drive.google.com/drive/folders/private', assets: [] },
  ] };
  const result = auditAssets(catalog, index, { localSize: () => 99 });
  assert.deepEqual(result.products[0].issues, ['missing-or-stale-drive-index-link:logo', 'local-size-mismatch:logo']);
  assert.equal(result.products[1].publicKit, false);
  assert.deepEqual(result.products[1].missing, ['private-inventory-review']);
});

test('distinguishes an unchecked Drive index from a missing project and rejects ambiguous indexes', () => {
  const unchecked = auditAssets(catalog, null, { productId: 'example' });
  assert.equal(unchecked.driveIndexChecked, false);
  assert.equal(unchecked.products[0].driveIndex, 'not-checked');
  assert.deepEqual(auditAssets(catalog, { products: [] }, { productId: 'example' }).products[0].issues,
    ['missing-drive-folder-in-index']);
  assert.throws(() => auditAssets(catalog, { products: [{ id: 'example' }, { id: 'example' }] }), /duplicate/);
  assert.throws(() => auditAssets(catalog, null, { productId: 'absent' }), /Unknown current product/);
});
