import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.REEL_ARTIFACT_BASE_URL ?? process.argv[2];
const key = process.env.REEL_ARTIFACT_SMOKE_KEY ?? process.argv[3];
const reportPath = process.env.ARTIFACT_LIVE_SMOKE_REPORT ?? 'tmp/artifact-live-smoke/report.json';

main().catch(async (error) => {
  const report = {
    schema: 'reel-pipeline.artifact-live-smoke.v1',
    ok: false,
    baseUrl: baseUrl ?? null,
    key: key ?? null,
    error: formatError(error),
    reportPath,
    generatedAt: new Date().toISOString(),
  };
  await writeReport(report);
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
});

async function main() {
  if (!baseUrl || !key) {
    throw new Error('usage: REEL_ARTIFACT_BASE_URL=https://... REEL_ARTIFACT_SMOKE_KEY=file.mp4 npm run smoke:artifact');
  }

  const normalizedBase = baseUrl.replace(/\/$/, '');
  const health = await fetch(`${normalizedBase}/health`);
  if (!health.ok) throw new Error(`artifact worker health failed: ${health.status} ${await health.text()}`);

  const artifact = await fetch(`${normalizedBase}/reels/${encodeURIComponent(key)}`);
  if (!artifact.ok) throw new Error(`artifact fetch failed: ${artifact.status} ${await artifact.text()}`);

  const contentType = artifact.headers.get('content-type') ?? '';
  if (!contentType.includes('video/') && !contentType.includes('application/octet-stream')) {
    throw new Error(`unexpected artifact content-type: ${contentType}`);
  }

  const range = await fetch(`${normalizedBase}/reels/${encodeURIComponent(key)}`, {
    headers: { range: 'bytes=0-15' },
  });
  if (range.status !== 206) {
    throw new Error(`artifact byte-range fetch failed: ${range.status} ${await range.text()}`);
  }

  const contentRange = range.headers.get('content-range') ?? '';
  if (!contentRange.startsWith('bytes 0-')) {
    throw new Error(`unexpected content-range: ${contentRange}`);
  }

  const report = {
    schema: 'reel-pipeline.artifact-live-smoke.v1',
    ok: true,
    baseUrl,
    key,
    contentType,
    cacheControl: artifact.headers.get('cache-control'),
    etag: artifact.headers.get('etag'),
    rangeStatus: range.status,
    contentRange,
    reportPath,
    generatedAt: new Date().toISOString(),
  };

  await writeReport(report);
  console.log(JSON.stringify(report, null, 2));
}

async function writeReport(report) {
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

function formatError(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}
