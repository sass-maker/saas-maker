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
  assert.deepEqual(result.products[0].issues, ['missing-or-stale-drive-index-link:logo', 'extra-drive-index-link:0', 'local-size-mismatch:logo']);
  assert.equal(result.products[1].publicKit, false);
  assert.deepEqual(result.products[1].missing, ['private-inventory-review']);
});

test('finds superseded links alongside current links and absent video posters', () => {
  const p = structuredClone(publicProject);
  p.submission.assets.push({ id: 'film', kind: 'video', label: 'Film', filename: 'film.mp4',
    mimeType: 'video/mp4', url: 'https://assets.example.com/film.mp4',
    posterUrl: '/product-assets/example/poster.jpg' });
  const index = { products: [{ id: 'example', driveFolderUrl: 'https://drive.example/folder', assets: [
    { publicDownloadUrl: 'https://sassmaker.com/product-assets/example/logo.png' },
    { publicDownloadUrl: 'https://assets.example.com/film.mp4' },
    { publicDownloadUrl: 'https://assets.example.com/film-old.mp4' },
  ] }] };
  const report = auditAssets({ directory: [p] }, index, { localSize: (path) => path.endsWith('poster.jpg') ? null : 42 });
  assert.deepEqual(report.products[0].issues, ['extra-drive-index-link:2', 'missing-local-poster:film']);
  index.products[0].assets.pop();
  index.products[0].assets.push({ filename: 'private-original.png' },
    { kind: 'video', publicDownloadUrl: 'https://assets.example.com/film-old.mp4', archived: true });
  assert.deepEqual(auditAssets({ directory: [p] }, index).products[0].issues, []);
  index.products[0].assets.push({ filename: 'bad.png', publicDownloadUrl: '' });
  assert.throws(() => auditAssets({ directory: [p] }, index), /Invalid public Drive asset link/);
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
