import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractFetches, safeDownloadUrl, startRemoteVerification } from '../launchkit/scripts/asset-verify.mjs';

function pair(id, tool, args, content) {
  const item = { id, type: 'mcp_tool_call', server: 'codex_apps', tool, arguments: args };
  return [JSON.stringify({ type: 'item.started', item }), JSON.stringify({ type: 'item.completed', item: { ...item, status: 'completed', error: null, result: { structured_content: content } } })];
}
const expected = [{ fileId: 'fileid', afterSha256: 'a'.repeat(64) }];
function events(id = 'fileid', address = 'https://files.oaiusercontent.com/test') {
  return [
    ...pair('m', 'google_drive.get_file_metadata', { fileId: id }, { id }),
    ...pair('f', 'google_drive.fetch', { url: `https://drive.google.com/file/d/${id}/view`, download_raw_file: true, include_base64: false }, { id, file_uri: { file_id: 'sediment://file-test', download_url: address } }),
  ];
}
test('binds actual tool events to expected Drive ID and raw download arguments', () => {
  assert.equal(extractFetches(events(), expected).get('fileid'), 'https://files.oaiusercontent.com/test');
  assert.throws(() => extractFetches(events('another'), expected), /Incomplete/);
  assert.throws(() => extractFetches(events().slice(1), expected), /Incomplete/);
  assert.throws(() => extractFetches([...events(), ...events()], expected), /Ambiguous/);
});
test('rejects untrusted hosts, credentials, protocols and ports', () => {
  for (const value of ['https://oaiusercontent.com.evil.test/x', 'http://files.oaiusercontent.com/x', 'https://name:pass@files.oaiusercontent.com/x', 'https://files.oaiusercontent.com:444/x']) assert.throws(() => safeDownloadUrl(value));
  assert.equal(safeDownloadUrl('https://files.oaiusercontent.com/x').hostname, 'files.oaiusercontent.com');
});
test('failed verifier spawn settles without a recurring group polling timer', async () => {
  const worker = startRemoteVerification({ expected, codexPath: '/no/such/codex', cwd: '/tmp', args: [], timeoutMs: 1000 });
  assert.equal(await worker.promise, false);
});
