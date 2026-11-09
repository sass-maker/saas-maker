import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { applyProposal, classifyRecovery, validateAsset } from '../launchkit/scripts/asset-apply.mjs';
import { start, resolveRecovery } from '../launchkit/scripts/asset-watch.mjs';

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

test('missing or unsafe recovery evidence and missing Drive items require recovery when service is available', () => {
  const f = fixture(); const result = applyProposal(f);
  const backup = join(result.recovery, '0.bak'); const saved = backup + '.saved';
  renameSync(backup, saved);
  assert.equal(classifyRecovery({ ...f, recovery: result.recovery, serviceAvailable: () => false, expectPrepared: true }).status, 'needs_recovery');
  symlinkSync(saved, backup);
  assert.equal(classifyRecovery({ ...f, recovery: result.recovery, serviceAvailable: () => false, expectPrepared: true }).status, 'needs_recovery');
  const link = join(f.root, 'recovery-link'); symlinkSync(result.recovery, link, 'dir');
  assert.equal(classifyRecovery({ ...f, recovery: link, expectPrepared: true }).status, 'needs_recovery');
  const g = fixture(); const staged = applyProposal(g); renameSync(g.destination, g.destination + '.moved');
  assert.equal(classifyRecovery({ ...g, recovery: staged.recovery, serviceAvailable: () => true, expectPrepared: true }).status, 'needs_recovery');
  assert.equal(classifyRecovery({ ...g, recovery: staged.recovery, serviceAvailable: () => false, expectPrepared: true }).status, 'retryable');
  assert.equal(classifyRecovery({ ...g, recovery: join(g.root, 'missing'), expectPrepared: true }).status, 'needs_recovery');
});

test('missing xattr requires recovery with a live service but retries an unavailable service', () => {
  const f = fixture(); const result = applyProposal(f);
  f.getId = (path) => { if (path === f.indexPath) return 'indexid'; const error = Error('xattr missing'); error.status = 1; throw error; };
  assert.equal(classifyRecovery({ ...f, recovery: result.recovery, serviceAvailable: () => true, expectPrepared: true }).status, 'needs_recovery');
  assert.equal(classifyRecovery({ ...f, recovery: result.recovery, serviceAvailable: () => false, expectPrepared: true }).status, 'retryable');
});

test('missing mount, index or index provider identity remains retryable while Drive is running', () => {
  for (const mode of ['root', 'index', 'index-xattr']) {
    const f = fixture(); const result = applyProposal(f);
    const target = mode === 'root' ? f.assetRoot : f.indexPath;
    if (mode === 'index-xattr') {
      const original = f.getId; f.getId = (path) => { if (path === f.indexPath) { const error = Error('index xattr unavailable'); error.status = 1; throw error; } return original(path); };
    } else renameSync(target, target + '.offline');
    const state = classifyRecovery({ recovery: result.recovery, assetRoot: f.assetRoot, indexPath: f.indexPath, selected: f.selected, getId: f.getId, serviceAvailable: () => true, expectPrepared: true });
    assert.equal(state.status, 'retryable', mode); assert.equal(state.expectPrepared, true);
  }
});

test('missing Submission kits requires recovery after root and index identity are verified', () => {
  const f = fixture(); const result = applyProposal(f);
  const kits = join(f.assetRoot, 'Submission kits'); renameSync(kits, kits + '.missing');
  const missing = classifyRecovery({ ...f, recovery: result.recovery, serviceAvailable: () => true, expectPrepared: true });
  assert.equal(missing.status, 'needs_recovery'); assert.match(missing.reason, /Submission kits folder is missing/);
  assert.equal(classifyRecovery({ ...f, recovery: result.recovery, serviceAvailable: () => false, expectPrepared: true }).status, 'retryable');
});

test('interrupted apply at startup remains pending if the Drive index is not mounted yet', () => {
  const f = fixture(); const result = applyProposal(f); const recoveryId = result.recovery.split('/').at(-1);
  renameSync(f.indexPath, f.indexPath + '.offline');
  const fleet = join(f.root, 'fleet'); const project = join(fleet, 'project'); mkdirSync(project, { recursive: true });
  execFileSync('git', ['init', '-q', project]);
  execFileSync('git', ['-C', project, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '--allow-empty', '-qm', 'base']);
  mkdirSync(join(fleet, 'site-health/catalog'), { recursive: true });
  writeFileSync(join(fleet, 'site-health/catalog/projects.json'), JSON.stringify({ projects: [{ id: 'product', lifecycle: { portfolioStatus: 'active' }, repositories: { localPath: 'project' } }] }));
  writeFileSync(join(f.root, 'state.json'), JSON.stringify({ pending: { product: { generation: 1, changedAt: 1, failures: 0, retryAt: 0, sources: [] } }, checkpoints: {}, inflight: { phase: 'applying', selected: { product: 1 }, recoveryId } }));
  const stop = start({ fleetRoot: fleet, indexPath: f.indexPath, stateDir: f.root, codexPath: '/unused', records: () => [], requireLock: false, classify: (args) => classifyRecovery({ ...args, getId: f.getId, serviceAvailable: () => true }) });
  stop();
  const entry = JSON.parse(readFileSync(join(f.root, 'state.json'), 'utf8')).pending.product;
  assert.equal(entry.needsRecovery, null); assert.equal(entry.verificationPending, true); assert.equal(entry.expectPrepared, true);
});

test('resolve does not convert an unavailable Drive index into a permanent or successful decision', () => {
  const f = fixture(); const result = applyProposal(f); renameSync(f.indexPath, f.indexPath + '.offline');
  const state = { pending: { product: { generation: 1, needsRecovery: 'manual review', recovery: result.recovery } } };
  assert.throws(() => resolveRecovery({ state, id: 'product', stateDir: f.root, indexPath: f.indexPath, classify: (args) => classifyRecovery({ ...args, getId: f.getId, serviceAvailable: () => true }) }), /temporarily unavailable/);
  assert.equal(state.pending.product.needsRecovery, 'manual review');
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
  for (const value of ['sk_live_' + 'a'.repeat(20), 'ghp_' + 'b'.repeat(20), 'github_pat_' + 'c'.repeat(20), 'AKIA' + 'D'.repeat(16), 'xoxb-' + 'e'.repeat(20), 'password: Abcdef123456789!']) assert.throws(() => validateAsset('brief', 'brief.txt', Buffer.from(value)));
  assert.throws(() => validateAsset('json', 'submission.json', Buffer.from('{"client_secret":"Abcdef123456789!"}')));
  assert.throws(() => validateAsset('json', 'submission.json', Buffer.from('{"password":"Abcdef123456789!"}')));
  for (const value of ['password: P@ssw0rd2024!', 'password=Tr0ub4dor&3xyz', 'password: Hunter2!x', 'password: hunter2hunter2hunter2', 'password=correcthorsebatterystaple', 'api_key: abcdefabcdefabcdefabcdef', 'secret: ' + 'a1'.repeat(32)]) assert.throws(() => validateAsset('brief', 'brief.txt', Buffer.from(value)));
  assert.throws(() => validateAsset('json', 'submission.json', Buffer.from('{"apiKey":"abcdefabcdefabcdefabcdef"}')));
  assert.throws(() => validateAsset('json', 'submission.json', Buffer.from('{"password":"Abcdef!!"}')));
  assert.throws(() => validateAsset('brief', 'brief.txt', Buffer.from('password=Abcd!xyz')));
  assert.doesNotThrow(() => validateAsset('brief', 'brief.txt', Buffer.from('Demo password: available on request. Our secret: integration-first. Our secret: Simplicity. Password: Optional. The secret: Fast-onboarding.')));
  assert.doesNotThrow(() => validateAsset('brief', 'brief.txt', Buffer.from('client_secret: <your-client-secret-here> access_token=https://example.com/docs/auth api_key=YOUR_API_KEY_HERE')));
  for (const value of ['password: Summer-2024-Secret', 'password: Abcd-Efgh1234ijkl5678wxyz', 'api_key: live-9f8a7b6c5d4e3f2a1b0c', 'password: Summer-2024', 'password: Welcome-2025!', 'password: Qwerty-Pass1', 'password: Pa$$word', 'password: Hunter!xY', 'password: Abcdef!!', 'secret: Built-in2FA', 'secret=https://hooks.slack.com/services/T0000/B0000/XXXXXXXXXXXXXXXX', 'access_token=https://example.com/docs/auth?token=123456789', 'secret=https://name:pass@example.com/docs/auth', 'password=YOUR_ACTUAL_PASSWORD_123']) assert.throws(() => validateAsset('brief', 'brief.txt', Buffer.from(value)), value);
  assert.throws(() => validateAsset('screenshot', 'image.svg', Buffer.from('<svg/>')));
});
