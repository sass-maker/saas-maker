import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { applyProposal, classifyRecovery, validateAsset } from '../launchkit/scripts/asset-apply.mjs';

const hash = (value) => createHash('sha256').update(value).digest('hex');
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'asset-apply-'));
  const assetRoot = join(root, 'assets'); const scratchDir = join(root, 'scratch'); const recoveryDir = join(root, 'recovery');
  const folder = join(assetRoot, 'Submission kits', 'product');
  mkdirSync(folder, { recursive: true }); mkdirSync(scratchDir);
  const destination = join(folder, 'brief.txt'); const source = join(scratchDir, 'new.txt');
  writeFileSync(destination, 'old'); writeFileSync(source, 'new');
  const indexPath = join(assetRoot, 'Fleet-product-asset-index.json');
  writeFileSync(indexPath, JSON.stringify({ products: [{ id: 'product', driveFolderUrl: 'https://drive.google.com/drive/folders/folderid', assets: [{ filename: 'brief.txt', kind: 'brief', driveUrl: 'https://drive.google.com/file/d/fileid/view' }] }] }));
  const proposal = { version: 1, changes: [{ productId: 'product', filename: 'brief.txt', sourceFile: 'new.txt', beforeSha256: hash('old') }] };
  const getId = (path) => path === indexPath ? 'indexid' : path === folder ? 'folderid' : path === destination ? 'fileid' : '';
  return { root, assetRoot, scratchDir, recoveryDir, indexPath, proposal, destination, getId, selected: ['product'], get expectedIndex() { return { fileId: 'indexid', afterSha256: hash(readFileSync(indexPath)) }; } };
}

test('updates only indexed existing file, saves recovery bytes, and reports remote verification pending', () => {
  const f = fixture(); const result = applyProposal(f);
  assert.equal(result.status, 'verification_pending');
  assert.equal(readFileSync(f.destination, 'utf8'), 'new');
  assert.equal(readFileSync(join(result.recovery, '0.bak'), 'utf8'), 'old');
  assert.equal(JSON.parse(readFileSync(join(result.recovery, 'manifest.json'), 'utf8')).changes[0].fileId, 'fileid');
});

test('rejects unauthorized, missing, symlinked and wrong-identity destinations without mutation', () => {
  for (const mode of ['other-product', 'unindexed-file', 'wrong-id', 'escape', 'symlink-source']) {
    const f = fixture();
    if (mode === 'other-product') f.proposal.changes[0].productId = 'different';
    if (mode === 'unindexed-file') f.proposal.changes[0].filename = 'other.png';
    if (mode === 'wrong-id') f.getId = () => 'wrong';
    if (mode === 'escape') f.proposal.changes[0].sourceFile = '../outside';
    if (mode === 'symlink-source') { symlinkSync(f.destination, join(f.scratchDir, 'link.png')); f.proposal.changes[0].sourceFile = 'link.png'; }
    assert.throws(() => applyProposal(f));
    assert.equal(readFileSync(f.destination, 'utf8'), 'old');
  }
});

test('refuses a concurrently changed destination before applying', () => {
  const f = fixture(); writeFileSync(f.destination, 'other writer');
  assert.throws(() => applyProposal(f), /changed since proposal/);
  assert.equal(readFileSync(f.destination, 'utf8'), 'other writer');
});

test('rejects a changed or unverified master index before even a no-change proposal', () => {
  const f = fixture(); const expectedIndex = f.expectedIndex;
  writeFileSync(f.indexPath, readFileSync(f.indexPath, 'utf8') + ' ');
  f.proposal.changes = [];
  assert.throws(() => applyProposal({ ...f, expectedIndex }), /does not match verified remote index/);
  assert.equal(readFileSync(f.destination, 'utf8'), 'old');
});

test('keeps recovery bytes and reports uncertainty after a partial write failure', () => {
  const f = fixture();
  f.writeAsset = (path) => { writeFileSync(path, 'partial'); throw Error('simulated interrupted write'); };
  const result = applyProposal(f);
  assert.equal(result.status, 'uncertain');
  assert.equal(readFileSync(join(result.recovery, '0.bak'), 'utf8'), 'old');
  assert.equal(JSON.parse(readFileSync(join(result.recovery, 'result.json'), 'utf8')).status, 'uncertain');
});

test('recovery distinguishes missing preparation, unchanged bytes, applied bytes and independent changes', () => {
  const f = fixture();
  const missing = join(f.root, 'missing-batch');
  assert.equal(classifyRecovery({ ...f, recovery: missing }).status, 'replan');
  const preparedOnly = join(f.root, 'preparation'); mkdirSync(preparedOnly);
  assert.equal(classifyRecovery({ ...f, recovery: preparedOnly }).status, 'replan');
  const originalGetId = f.getId; let targetReads = 0;
  f.getId = (path) => path === f.destination && ++targetReads === 2 ? 'changed' : originalGetId(path);
  const aborted = applyProposal(f);
  f.getId = originalGetId;
  assert.equal(classifyRecovery({ ...f, recovery: aborted.recovery }).status, 'replan');
  f.writeAsset = () => { throw Error('write began but outcome unknown'); };
  const ambiguous = applyProposal(f);
  assert.equal(classifyRecovery({ ...f, recovery: ambiguous.recovery }).status, 'needs_recovery');
  assert.equal(classifyRecovery({ ...f, recovery: ambiguous.recovery }).reviewable, true);
  delete f.writeAsset;
  const applied = applyProposal(f);
  assert.equal(classifyRecovery({ ...f, recovery: applied.recovery }).status, 'verification_pending');
  writeFileSync(f.destination, 'old');
  assert.equal(classifyRecovery({ ...f, recovery: applied.recovery }).status, 'needs_recovery');
  writeFileSync(f.destination, 'independent change');
  assert.equal(classifyRecovery({ ...f, recovery: applied.recovery }).status, 'needs_recovery');
  assert.equal(classifyRecovery({ ...f, recovery: applied.recovery }).reviewable, true);
});

test('temporary Drive metadata I/O leaves staged recovery retryable', () => {
  const f = fixture(); const result = applyProposal(f); const original = f.getId;
  f.getId = () => { const error = Error('temporary I/O'); error.code = 'EIO'; throw error; };
  assert.equal(classifyRecovery({ ...f, recovery: result.recovery }).status, 'retryable');
  f.getId = original;
  assert.equal(classifyRecovery({ ...f, recovery: result.recovery }).status, 'verification_pending');
});

test('partial two-file application is held for recovery and never auto-reapplied', () => {
  const f = fixture();
  const folder = join(f.assetRoot, 'Submission kits', 'product');
  const second = join(folder, 'second.txt'); writeFileSync(second, 'old2');
  writeFileSync(join(f.scratchDir, 'new2.txt'), 'new2');
  const index = JSON.parse(readFileSync(f.indexPath, 'utf8'));
  index.products[0].assets.push({ filename: 'second.txt', kind: 'brief', driveUrl: 'https://drive.google.com/file/d/secondid/view' });
  writeFileSync(f.indexPath, JSON.stringify(index));
  f.getId = (path) => path === f.indexPath ? 'indexid' : path === folder ? 'folderid' : path === f.destination ? 'fileid' : path === second ? 'secondid' : '';
  f.proposal.changes.push({ productId: 'product', filename: 'second.txt', sourceFile: 'new2.txt', beforeSha256: hash('old2') });
  let calls = 0; f.writeAsset = (path, bytes) => { if (++calls === 2) throw Error('second write failed'); writeFileSync(path, bytes); };
  const result = applyProposal(f);
  assert.equal(result.status, 'uncertain');
  assert.equal(classifyRecovery({ ...f, recovery: result.recovery }).status, 'needs_recovery');
  assert.equal(readFileSync(f.destination, 'utf8'), 'new');
  assert.equal(readFileSync(second, 'utf8'), 'old2');
});

test('allows uniquely indexed briefs and product JSON with verified Drive IDs', () => {
  for (const [kind, filename] of [['brief', 'press.txt'], ['json', 'submission.json']]) {
    const f = fixture();
    const folder = join(f.assetRoot, 'Submission kits', 'product');
    f.destination = join(folder, filename); writeFileSync(f.destination, 'old');
    const index = JSON.parse(readFileSync(f.indexPath, 'utf8'));
    index.products[0].assets.push({ filename, kind, driveUrl: 'https://drive.google.com/file/d/briefid/view' });
    writeFileSync(f.indexPath, JSON.stringify(index));
    f.getId = (path) => path === f.indexPath ? 'indexid' : path === folder ? 'folderid' : path === f.destination ? 'briefid' : '';
    f.proposal.changes[0].filename = filename;
    if (kind === 'json') writeFileSync(join(f.scratchDir, 'new.txt'), '{"name":"new"}');
    assert.equal(applyProposal(f).status, 'verification_pending');
    assert.equal(readFileSync(f.destination, 'utf8'), kind === 'json' ? '{"name":"new"}' : 'new');
  }
});

test('checks expected formats and rejects malformed or sensitive proposed text', () => {
  assert.doesNotThrow(() => validateAsset('logo', 'logo.png', Buffer.from('89504e470d0a1a0a00000000', 'hex')));
  assert.throws(() => validateAsset('logo', 'logo.png', Buffer.from('not a png')));
  assert.throws(() => validateAsset('json', 'submission.json', Buffer.from('{bad')));
  assert.throws(() => validateAsset('brief', 'brief.txt', Buffer.from('-----BEGIN PRIVATE KEY-----')));
  for (const value of ['sk_live_' + 'a'.repeat(20), 'ghp_' + 'b'.repeat(20), 'github_pat_' + 'c'.repeat(20), 'AKIA' + 'D'.repeat(16), 'xoxb-' + 'e'.repeat(20), 'password: illustrative-value']) assert.throws(() => validateAsset('brief', 'brief.txt', Buffer.from(value)));
  assert.throws(() => validateAsset('screenshot', 'image.svg', Buffer.from('<svg/>')));
});
