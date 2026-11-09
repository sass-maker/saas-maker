import { createHash } from 'node:crypto';
import { request } from 'node:https';
import { spawn } from 'node:child_process';

const MAX_EVENTS = 4 * 1024 * 1024;
const MAX_FILE = 100 * 1024 * 1024;

export function safeDownloadUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw Error('Invalid download address'); }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || !(url.hostname === 'oaiusercontent.com' || url.hostname.endsWith('.oaiusercontent.com'))) throw Error('Untrusted download address');
  return url;
}

export function extractFetches(lines, expected) {
  const ids = new Set(expected.map((item) => item.fileId));
  if (!ids.size || ids.size !== expected.length || [...ids].some((id) => !/^[a-zA-Z0-9_-]+$/.test(id))) throw Error('Invalid expected Drive IDs');
  const started = new Map(); const metadata = new Set(); const urls = new Map();
  for (const line of lines) {
    const event = JSON.parse(line);
    const item = event?.item;
    if (item?.type !== 'mcp_tool_call' || item.server !== 'codex_apps') continue;
    if (event.type === 'item.started') { started.set(item.id, item); continue; }
    if (event.type !== 'item.completed' || item.status !== 'completed' || item.error) continue;
    const first = started.get(item.id);
    if (!first || first.tool !== item.tool || JSON.stringify(first.arguments) !== JSON.stringify(item.arguments)) continue;
    if (item.tool === 'google_drive.get_file_metadata') {
      const id = item.arguments?.fileId;
      if (ids.has(id) && item.result?.structured_content?.id === id) metadata.add(id);
    }
    if (item.tool === 'google_drive.fetch') {
      const match = item.arguments?.url?.match(/^https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)\/view$/);
      const id = match?.[1]; const content = item.result?.structured_content;
      if (!ids.has(id) || item.arguments?.download_raw_file !== true || item.arguments?.include_base64 !== false || content?.id !== id || typeof content?.file_uri?.file_id !== 'string' || !content.file_uri.file_id.startsWith('sediment://')) continue;
      if ((content.structuredContent?.id != null && content.structuredContent.id !== id) || (content.structuredContent?.file_uri?.file_id != null && content.structuredContent.file_uri.file_id !== content.file_uri.file_id) || (content.structuredContent?.file_id != null && content.structuredContent.file_id !== content.file_uri.file_id)) throw Error('Conflicting Drive identity');
      const url = safeDownloadUrl(content.file_uri.download_url).href;
      const alternates = [content.structuredContent?.file_uri?.download_url, content.structuredContent?.download_url].filter((value) => value != null);
      if (alternates.some((value) => safeDownloadUrl(value).href !== url)) throw Error('Conflicting Drive response');
      if (urls.has(id)) throw Error('Ambiguous Drive response');
      urls.set(id, url);
    }
  }
  if ([...ids].some((id) => !metadata.has(id) || !urls.has(id))) throw Error('Incomplete Drive verification');
  return urls;
}

export function downloadHash(value, redirects = 0) {
  if (redirects > 3) return Promise.reject(Error('Too many redirects'));
  let url;
  try { url = safeDownloadUrl(value); } catch { return Promise.reject(Error('Untrusted download address')); }
  return new Promise((resolve, reject) => {
    const req = request(url, { method: 'GET', timeout: 30000 }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        const location = res.headers.location; res.resume();
        try { resolve(downloadHash(new URL(location, url).href, redirects + 1)); } catch { reject(Error('Invalid redirect')); }
        return;
      }
      if (res.statusCode !== 200 || Number(res.headers['content-length'] || 0) > MAX_FILE) { res.resume(); reject(Error('Remote download unavailable')); return; }
      let bytes = 0; const hash = createHash('sha256');
      res.on('data', (chunk) => { bytes += chunk.length; if (bytes > MAX_FILE) { res.destroy(); reject(Error('Remote file too large')); } else hash.update(chunk); });
      res.on('end', () => resolve(hash.digest('hex')));
      res.on('error', () => reject(Error('Remote download failed')));
      res.on('aborted', () => reject(Error('Remote download failed')));
    });
    req.on('timeout', () => req.destroy());
    req.on('error', () => reject(Error('Remote download failed')));
    req.end();
  });
}

export function startRemoteVerification({ expected, codexPath, cwd, args, lockFd, timeoutMs = 120000, download = downloadHash }) {
  if (!Array.isArray(expected) || !expected.length || expected.length > 50 || expected.some((x) => !/^[a-zA-Z0-9_-]+$/.test(x.fileId) || !/^[a-f0-9]{64}$/.test(x.afterSha256))) throw Error('Invalid verification request');
  const ids = expected.map((x) => x.fileId);
  if (new Set(ids).size !== ids.length) throw Error('Duplicate verification ID');
  const prompt = `For each Drive file ID in this JSON array, call google_drive.get_file_metadata with fileId, then call google_drive.fetch with download_raw_file=true, include_base64=false, url exactly https://drive.google.com/file/d/ID/view. Do not print or summarize tool results or URLs. IDs: ${JSON.stringify(ids)}`;
  const stdio = ['ignore', 'pipe', 'ignore'];
  if (Number.isInteger(lockFd) && lockFd >= 3) { while (stdio.length < lockFd) stdio.push('ignore'); stdio[lockFd] = lockFd; }
  const child = spawn(codexPath, ['exec', '--json', '--ephemeral', '--skip-git-repo-check', '-s', 'read-only', '-C', cwd, ...args, prompt], { stdio, detached: true });
  const promise = new Promise((resolve) => {
    let data = ''; let bytes = 0; let failed = false; let timedOut = false; let done = false;
    const finish = (value) => { if (done) return; done = true; clearTimeout(timeout); resolve(value); };
    const terminate = () => { try { process.kill(-child.pid, 'SIGTERM'); } catch {} setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }, 2000).unref(); };
    const timeout = setTimeout(() => { timedOut = true; terminate(); }, timeoutMs);
    child.stdout.on('data', (chunk) => { bytes += chunk.length; if (bytes > MAX_EVENTS && !failed) { failed = true; terminate(); } else if (!failed) data += chunk.toString('utf8'); });
    child.on('error', () => finish(false));
    child.on('close', (code) => {
      const settled = async () => {
      if (done) return;
      if (Number.isInteger(child.pid) && child.pid > 0) {
        try { process.kill(-child.pid, 0); setTimeout(settled, 200); return; } catch (error) { if (error.code === 'EPERM') { setTimeout(settled, 200); return; } }
      }
      clearTimeout(timeout);
      if (code !== 0 || timedOut || failed) { finish(false); return; }
      try {
        const urls = extractFetches(data.split('\n').filter(Boolean), expected);
        for (const item of expected) if (await download(urls.get(item.fileId)) !== item.afterSha256) { finish(false); return; }
        finish(true);
      } catch { finish(false); }
      };
      settled();
    });
  });
  return { child, promise };
}
