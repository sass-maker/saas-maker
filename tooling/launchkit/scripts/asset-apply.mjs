import { constants, closeSync, existsSync, fstatSync, fsyncSync, ftruncateSync, lstatSync, mkdirSync, openSync, readFileSync, writeFileSync, writeSync } from 'node:fs';
import { basename, join, resolve, sep } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const MAX_INDEX = 4 * 1024 * 1024;
const MAX_ASSET = 100 * 1024 * 1024;
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
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
export function driveItemId(path) {
  return execFileSync('/usr/bin/xattr', ['-p', 'com.google.drivefs.item-id#S', path], { encoding: 'utf8', timeout: 10000 }).trim();
}
export function applyProposal({ proposal, selected, indexPath, assetRoot, scratchDir, recoveryDir, recoveryId = randomUUID(), getId = driveItemId, writeAsset }) {
  if (!proposal || Object.keys(proposal).sort().join(',') !== 'changes,version' || proposal.version !== 1 || !Array.isArray(proposal.changes) || proposal.changes.length > 10) throw Error('Invalid proposal');
  if (!Array.isArray(selected) || selected.some((id) => !safeId(id)) || new Set(selected).size !== selected.length) throw Error('Invalid selected products');
  inspect(assetRoot, true); inspect(scratchDir, true);
  const expectedIndex = join(assetRoot, 'Fleet-product-asset-index.json');
  if (resolve(indexPath) !== resolve(expectedIndex)) throw Error('Index is outside the asset root');
  const indexBytes = bounded(indexPath, MAX_INDEX);
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
    plan.push({ productId: change.productId, filename: change.filename, fileId, destination, destinationStat, before, after, beforeSha256: change.beforeSha256, afterSha256: digest(after) });
  }
  if (digest(bounded(indexPath, MAX_INDEX)) !== digest(indexBytes)) throw Error('Asset index changed during validation');
  const changed = plan.filter((item) => item.beforeSha256 !== item.afterSha256);
  if (!changed.length) return { status: 'no_changes', products: selected, changes: [] };
  mkdirSync(recoveryDir, { recursive: true, mode: 0o700 }); inspect(recoveryDir, true);
  if (!/^[a-f0-9-]{36}$/.test(recoveryId)) throw Error('Invalid recovery ID');
  const batch = join(recoveryDir, recoveryId); mkdirSync(batch, { mode: 0o700 });
  const manifest = changed.map(({ productId, filename, fileId, beforeSha256, afterSha256 }, i) => ({ productId, filename, fileId, beforeSha256, afterSha256, backup: `${i}.bak` }));
  for (const [i, item] of changed.entries()) {
    const fd = openSync(join(batch, `${i}.bak`), constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
    try { writeFileSync(fd, item.before); fsyncSync(fd); } finally { closeSync(fd); }
  }
  const manifestFd = openSync(join(batch, 'manifest.json'), constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
  try { writeFileSync(manifestFd, JSON.stringify({ status: 'prepared', changes: manifest }, null, 2)); fsyncSync(manifestFd); } finally { closeSync(manifestFd); }
  try {
    for (const item of changed) {
      if (digest(bounded(item.destination, MAX_ASSET)) !== item.beforeSha256 || getId(item.destination) !== item.fileId || digest(bounded(indexPath, MAX_INDEX)) !== digest(indexBytes)) throw Error('Destination or index changed before write');
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
