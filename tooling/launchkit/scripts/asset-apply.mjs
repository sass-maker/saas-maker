import { constants, closeSync, fstatSync, fsyncSync, ftruncateSync, lstatSync, mkdirSync, openSync, readFileSync, writeFileSync, writeSync } from 'node:fs';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const MAX_INDEX = 4 * 1024 * 1024;
const MAX_ASSET = 100 * 1024 * 1024;
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
export function validateAsset(kind, filename, bytes) {
  const extension = filename.toLowerCase().split('.').pop();
  const allowed = { logo: ['png', 'svg', 'jpg', 'jpeg', 'webp'], screenshot: ['png', 'jpg', 'jpeg', 'webp'], video: ['mp4', 'mov', 'webm'], brief: ['txt', 'md'], json: ['json'] };
  if (!allowed[kind]?.includes(extension)) throw Error('Asset kind and extension do not match');
  const hex = bytes.subarray(0, 16).toString('hex');
  if (extension === 'png' && !hex.startsWith('89504e470d0a1a0a')) throw Error('Invalid PNG bytes');
  if (['jpg', 'jpeg'].includes(extension) && !hex.startsWith('ffd8ff')) throw Error('Invalid JPEG bytes');
  if (extension === 'webp' && !(bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP')) throw Error('Invalid WebP bytes');
  if (['mp4', 'mov'].includes(extension) && bytes.subarray(4, 8).toString('ascii') !== 'ftyp') throw Error('Invalid video bytes');
  if (extension === 'webm' && !hex.startsWith('1a45dfa3')) throw Error('Invalid WebM bytes');
  if (['svg', 'txt', 'md', 'json'].includes(extension)) {
    if (bytes.length > 1024 * 1024) throw Error('Text asset exceeds size limit');
    let value; try { value = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw Error('Invalid UTF-8'); }
    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:sk-proj-|sk-|sk_live_|ghp_|github_pat_|xox[baprs]-)[a-zA-Z0-9_-]{16,}|\bAKIA[A-Z0-9]{16}\b/i.test(value)) throw Error('Possible secret in proposed text asset');
    const assignments = value.matchAll(/\b(api[_-]?key|access[_-]?token|client[_-]?secret|password|secret)["']?\s*[:=]\s*["']?([^\s"',}]{8,})/gi);
    for (const [, , candidate] of assignments) {
      const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z0-9]/].filter((pattern) => pattern.test(candidate)).length;
      if (classes >= 3 || (candidate.length >= 20 && classes >= 2) || /^[a-zA-Z0-9]{24,}$/.test(candidate)) throw Error('Possible secret in proposed text asset');
    }
    if (extension === 'json') { try { JSON.parse(value); } catch { throw Error('Invalid JSON asset'); } }
    if (extension === 'svg' && (!/^\s*(?:<\?xml[^>]*>\s*)?<svg\b/i.test(value) || /<!DOCTYPE|<!ENTITY|<script\b|\bon\w+\s*=/i.test(value))) throw Error('Invalid or unsafe SVG asset');
  }
}
const safeId = (value) => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(value);
const driveId = (url, folder) => {
  const match = typeof url === 'string' && url.match(folder ? /^https:\/\/drive\.google\.com\/drive\/folders\/([a-zA-Z0-9_-]+)(?:[/?#]|$)/ : /^https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)(?:[/?#]|$)/);
  if (!match) throw Error('Invalid indexed Drive item URL');
  return match[1];
};
function inspect(path, directory = false) {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink() || (directory ? !stat.isDirectory() : !stat.isFile() || stat.nlink !== 1)) throw Error('Unsafe file or directory');
  return stat;
}
function contained(root, relative) {
  if (typeof relative !== 'string' || !relative || relative.startsWith('/') || relative.split(/[\\/]/).some((p) => !p || p === '.' || p === '..')) throw Error('Invalid relative path');
  const absolute = resolve(root, relative);
  if (!absolute.startsWith(resolve(root) + sep)) throw Error('Path escapes allowed directory');
  const parts = relative.split(/[\\/]/); let path = root;
  inspect(path, true);
  for (let i = 0; i < parts.length; i++) { path = join(path, parts[i]); inspect(path, i < parts.length - 1); }
  return absolute;
}
function bounded(path, max) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const st = fstatSync(fd);
    if (!st.isFile() || st.nlink !== 1 || st.size > max) throw Error('Invalid or oversized file');
    return readFileSync(fd);
  } finally { closeSync(fd); }
}
function present(path) {
  try { lstatSync(path); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}
function syncDirectory(path) {
  const fd = openSync(path, constants.O_RDONLY);
  try { fsyncSync(fd); } finally { closeSync(fd); }
}
export function driveItemId(path) {
  return execFileSync('/usr/bin/xattr', ['-p', 'com.google.drivefs.item-id#S', path], { encoding: 'utf8', timeout: 10000 }).trim();
}
export function snapshotIndex({ indexPath, getId = driveItemId }) {
  const fileId = getId(indexPath);
  if (!safeId(fileId)) throw Error('Invalid mounted index identity');
  return { fileId, afterSha256: digest(bounded(indexPath, MAX_INDEX)) };
}
export function applyProposal({ proposal, selected, indexPath, assetRoot, scratchDir, recoveryDir, recoveryId = randomUUID(), expectedIndex, getId = driveItemId, writeAsset }) {
  if (!proposal || Object.keys(proposal).sort().join(',') !== 'changes,version' || proposal.version !== 1 || !Array.isArray(proposal.changes) || proposal.changes.length > 10) throw Error('Invalid proposal');
  if (!Array.isArray(selected) || selected.some((id) => !safeId(id)) || new Set(selected).size !== selected.length) throw Error('Invalid selected products');
  inspect(assetRoot, true); inspect(scratchDir, true);
  const expectedIndexPath = join(assetRoot, 'Fleet-product-asset-index.json');
  if (resolve(indexPath) !== resolve(expectedIndexPath)) throw Error('Index is outside the asset root');
  const indexBytes = bounded(indexPath, MAX_INDEX);
  if (!expectedIndex || !safeId(expectedIndex.fileId) || !/^[a-f0-9]{64}$/.test(expectedIndex.afterSha256) || getId(indexPath) !== expectedIndex.fileId || digest(indexBytes) !== expectedIndex.afterSha256) throw Error('Mounted asset index does not match verified remote index');
  const index = JSON.parse(indexBytes.toString('utf8'));
  if (!Array.isArray(index.products)) throw Error('Invalid asset index');
  const productMap = new Map();
  for (const product of index.products) {
    if (!safeId(product?.id) || productMap.has(product.id) || !Array.isArray(product.assets)) throw Error('Invalid or duplicate indexed product');
    productMap.set(product.id, product);
  }
  const seen = new Set(); const plan = []; let totalBytes = 0;
  for (const change of proposal.changes) {
    if (!change || Object.keys(change).sort().join(',') !== 'beforeSha256,filename,productId,sourceFile' || !selected.includes(change.productId) || !safeId(change.productId) || typeof change.filename !== 'string' || basename(change.filename) !== change.filename || change.filename === '.' || change.filename === '..' || change.filename.includes('\\') || !/^[a-f0-9]{64}$/.test(change.beforeSha256)) throw Error('Invalid proposed asset');
    const key = `${change.productId}\0${change.filename}`;
    if (seen.has(key)) throw Error('Duplicate proposed destination');
    seen.add(key);
    const product = productMap.get(change.productId);
    if (!product) throw Error('Unknown indexed product');
    const matches = product.assets.filter((asset) => asset?.filename === change.filename && asset.archived !== true);
    if (matches.length !== 1 || !['logo', 'screenshot', 'video', 'brief', 'json'].includes(matches[0].kind)) throw Error('Destination is not a unique indexed asset');
    const folder = join(assetRoot, 'Submission kits', change.productId);
    inspect(join(assetRoot, 'Submission kits'), true); inspect(folder, true);
    const destination = join(folder, change.filename); const destinationStat = inspect(destination);
    const fileId = driveId(matches[0].driveUrl, false);
    if (getId(folder) !== driveId(product.driveFolderUrl, true) || getId(destination) !== fileId) throw Error('Mounted Drive identity mismatch');
    const source = contained(scratchDir, change.sourceFile);
    const before = bounded(destination, MAX_ASSET); const after = bounded(source, MAX_ASSET);
    totalBytes += before.length + after.length;
    if (totalBytes > 200 * 1024 * 1024) throw Error('Proposal exceeds total size limit');
    if (digest(before) !== change.beforeSha256) throw Error('Destination changed since proposal');
    if (!after.length) throw Error('Empty proposed asset');
    validateAsset(matches[0].kind, change.filename, after);
    plan.push({ productId: change.productId, filename: change.filename, fileId, destination, destinationStat, before, after, beforeSha256: change.beforeSha256, afterSha256: digest(after) });
  }
  if (digest(bounded(indexPath, MAX_INDEX)) !== digest(indexBytes)) throw Error('Asset index changed during validation');
  const changed = plan.filter((item) => item.beforeSha256 !== item.afterSha256);
  if (!changed.length) return { status: 'no_changes', products: selected, changes: [] };
  mkdirSync(recoveryDir, { recursive: true, mode: 0o700 }); inspect(recoveryDir, true);
  syncDirectory(dirname(recoveryDir));
  if (!/^[a-f0-9-]{36}$/.test(recoveryId)) throw Error('Invalid recovery ID');
  const batch = join(recoveryDir, recoveryId); mkdirSync(batch, { mode: 0o700 });
  syncDirectory(recoveryDir);
  const manifest = changed.map(({ productId, filename, fileId, beforeSha256, afterSha256 }, i) => ({ productId, filename, fileId, beforeSha256, afterSha256, backup: `${i}.bak` }));
  for (const [i, item] of changed.entries()) {
    const fd = openSync(join(batch, `${i}.bak`), constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
    try { writeFileSync(fd, item.before); fsyncSync(fd); } finally { closeSync(fd); }
  }
  const manifestFd = openSync(join(batch, 'manifest.json'), constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
  try { writeFileSync(manifestFd, JSON.stringify({ status: 'prepared', changes: manifest }, null, 2)); fsyncSync(manifestFd); } finally { closeSync(manifestFd); }
  syncDirectory(batch);
  try {
    let marked = false;
    for (const item of changed) {
      if (digest(bounded(item.destination, MAX_ASSET)) !== item.beforeSha256 || getId(item.destination) !== item.fileId || digest(bounded(indexPath, MAX_INDEX)) !== digest(indexBytes)) throw Error('Destination or index changed before write');
      if (!marked) {
        const marker = openSync(join(batch, 'applying.txt'), constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
        try { writeFileSync(marker, 'applying\n'); fsyncSync(marker); } finally { closeSync(marker); }
        syncDirectory(batch); marked = true;
      }
      if (writeAsset) writeAsset(item.destination, item.after);
      else {
        const fd = openSync(item.destination, constants.O_RDWR | constants.O_NOFOLLOW);
        try {
          const current = fstatSync(fd);
          if (!current.isFile() || current.nlink !== 1 || current.dev !== item.destinationStat.dev || current.ino !== item.destinationStat.ino || current.size > MAX_ASSET || digest(readFileSync(fd)) !== item.beforeSha256) throw Error('Destination changed before opening');
          let offset = 0; while (offset < item.after.length) offset += writeSync(fd, item.after, offset, item.after.length - offset, offset);
          ftruncateSync(fd, item.after.length); fsyncSync(fd);
        } finally { closeSync(fd); }
      }
      if (digest(bounded(item.destination, MAX_ASSET)) !== item.afterSha256 || getId(item.destination) !== item.fileId) throw Error('Local Drive readback failed');
    }
    writeFileSync(join(batch, 'result.json'), JSON.stringify({ status: 'verification_pending', changes: manifest }, null, 2), { flag: 'wx', mode: 0o600 });
    return { status: 'verification_pending', recovery: batch, changes: manifest };
  } catch (error) {
    writeFileSync(join(batch, 'result.json'), JSON.stringify({ status: 'uncertain', message: error.message, changes: manifest }, null, 2), { flag: 'wx', mode: 0o600 });
    return { status: 'uncertain', recovery: batch, changes: manifest, error: error.message };
  }
}

function driveServiceAvailable() {
  if (process.platform !== 'darwin') return true;
  try { execFileSync('/usr/bin/pgrep', ['-x', 'Google Drive'], { timeout: 5000, stdio: 'ignore' }); return true; } catch { return false; }
}
function recoveryError(error, area, serviceAvailable, expectPrepared = false) {
  const transient = new Set(['EIO', 'EAGAIN', 'EBUSY', 'ETIMEDOUT', 'ENOTCONN', 'EINTR', 'ESTALE', 'ENXIO', 'ENODEV', 'ECONNRESET']);
  if (transient.has(error.code) || error.signal) return { status: 'retryable', expectPrepared, reason: 'Recovery or Drive metadata is temporarily unavailable' };
  if (area === 'mount' && (error.code === 'ENOENT' || error.status === 1)) return { status: 'retryable', expectPrepared, reason: 'Drive mount or index is unavailable' };
  if (area === 'drive' && (error.code === 'ENOENT' || error.status === 1)) {
    let available = false;
    try { available = serviceAvailable(); } catch {}
    if (!available) return { status: 'retryable', expectPrepared, reason: 'Drive service is unavailable' };
  }
  return { status: 'needs_recovery', reason: 'Recovery batch, Drive identity or backup cannot be validated' };
}
export function classifyRecovery({ recovery, assetRoot, indexPath, selected, getId = driveItemId, serviceAvailable = driveServiceAvailable, expectPrepared = false }) {
  if (!Array.isArray(selected) || selected.some((id) => !safeId(id))) throw Error('Invalid recovery selection');
  try { inspect(recovery, true); } catch (error) { return error.code === 'ENOENT' && !expectPrepared ? { status: 'replan' } : recoveryError(error, 'recovery', serviceAvailable, expectPrepared); }
  const manifestPath = join(recovery, 'manifest.json');
  try { lstatSync(manifestPath); } catch (error) {
    if (error.code === 'ENOENT' && !expectPrepared) {
      try { if (!present(join(recovery, 'applying.txt'))) return { status: 'replan' }; } catch (markerError) { return recoveryError(markerError, 'recovery', serviceAvailable, expectPrepared); }
    }
    return recoveryError(error, 'recovery', serviceAvailable, expectPrepared);
  }
  let area = 'recovery';
  try {
    if (resolve(indexPath) !== resolve(join(assetRoot, 'Fleet-product-asset-index.json'))) throw Error('Invalid asset index');
    const manifest = JSON.parse(bounded(manifestPath, MAX_INDEX).toString('utf8'));
    if (manifest.status !== 'prepared' || !Array.isArray(manifest.changes) || !manifest.changes.length || manifest.changes.length > 10) throw Error('Invalid recovery manifest');
    const resultPath = join(recovery, 'result.json');
    const result = present(resultPath) ? JSON.parse(bounded(resultPath, MAX_INDEX).toString('utf8')) : null;
    if (result && !['verification_pending', 'uncertain'].includes(result.status)) throw Error('Invalid recovery result');
    const markerPath = join(recovery, 'applying.txt');
    const marked = present(markerPath);
    if (marked && bounded(markerPath, 64).toString('utf8') !== 'applying\n') throw Error('Invalid recovery marker');
    for (const [i, entry] of manifest.changes.entries()) {
      if (!selected.includes(entry.productId) || !safeId(entry.productId) || typeof entry.filename !== 'string' || basename(entry.filename) !== entry.filename || entry.filename === '.' || entry.filename === '..' || entry.filename.includes('\\') || !/^[a-f0-9]{64}$/.test(entry.beforeSha256) || !/^[a-f0-9]{64}$/.test(entry.afterSha256) || entry.backup !== `${i}.bak`) throw Error('Invalid recovery entry');
      if (digest(bounded(join(recovery, entry.backup), MAX_ASSET)) !== entry.beforeSha256) throw Error('Recovery backup mismatch');
    }
    area = 'mount';
    inspect(assetRoot, true); inspect(join(assetRoot, 'Submission kits'), true); inspect(indexPath);
    if (!safeId(getId(indexPath))) return { status: 'retryable', expectPrepared: true, reason: 'Drive index identity is unavailable' };
    const index = JSON.parse(bounded(indexPath, MAX_INDEX).toString('utf8'));
    if (!Array.isArray(index.products)) throw Error('Invalid asset index');
    area = 'drive';
    const states = [];
    for (const entry of manifest.changes) {
      const products = index.products.filter((p) => p?.id === entry.productId);
      if (products.length !== 1 || !Array.isArray(products[0].assets)) throw Error('Unrecognized recovery product');
      const assets = products[0].assets.filter((a) => a?.filename === entry.filename && a.archived !== true);
      if (assets.length !== 1 || driveId(assets[0].driveUrl, false) !== entry.fileId) throw Error('Recovery asset changed in index');
      const folder = join(assetRoot, 'Submission kits', entry.productId);
      inspect(assetRoot, true); inspect(join(assetRoot, 'Submission kits'), true); inspect(folder, true);
      const target = join(folder, entry.filename); inspect(target);
      if (getId(folder) !== driveId(products[0].driveFolderUrl, true) || getId(target) !== entry.fileId) throw Error('Recovery identity mismatch');
      const current = digest(bounded(target, MAX_ASSET));
      states.push(current === entry.beforeSha256 ? 'before' : current === entry.afterSha256 ? 'after' : 'other');
    }
    if (states.every((state) => state === 'before')) return marked || result?.status === 'verification_pending' ? { status: 'needs_recovery', reviewable: true, reason: 'A write may have started or a completed destination changed after staging' } : { status: 'replan' };
    if (states.every((state) => state === 'after')) return { status: 'verification_pending' };
    return { status: 'needs_recovery', reviewable: true, reason: 'Recovery batch is partial or a destination changed independently' };
  } catch (error) {
    return recoveryError(error, area, serviceAvailable, true);
  }
}
