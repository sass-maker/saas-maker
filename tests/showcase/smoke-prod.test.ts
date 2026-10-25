import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const run = promisify(execFile);
const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const script = fileURLToPath(new URL('../../scripts/smoke-prod.mjs', import.meta.url));
const projection = JSON.parse(
  await readFile(new URL('../../catalog/generated/public.json', import.meta.url), 'utf8')
);
const publicProjects = projection.directory as { lifecycle: string }[];
const browsableProjectCount = publicProjects.filter(
  ({ lifecycle }) => lifecycle !== 'inactive'
).length;
const ideas = [
  ...Array.from({ length: 48 }, () => ({ source: 'curated' })),
  ...Array.from({ length: 92 }, () => ({ source: 'starterstory' })),
];

async function smokeWithRows(rows: number, jsonProjects = publicProjects) {
  const server = createServer((request, response) => {
    let body: string;
    switch (request.url) {
      case '/':
        body = 'SaaS Maker';
        break;
      case '/projects':
        body =
          '<p>First retained commit · Latest retained commit</p>' +
          '<details class="directory-row" data-directory-row></details>'.repeat(rows);
        break;
      case '/projects.json':
        body = JSON.stringify(jsonProjects);
        break;
      case '/ideas':
        body = '<tr data-idea-row></tr>'.repeat(48);
        break;
      case '/ideas.json':
        body = JSON.stringify(ideas);
        break;
      default:
        response.writeHead(404).end();
        return;
    }
    response.writeHead(200).end(body);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('fixture server has no port');
  try {
    const options = {
      cwd: repoRoot,
      env: {
        ...process.env,
        SAAS_MAKER_DIRECTORY: `http://127.0.0.1:${address.port}`,
      },
      timeout: 10_000,
    };
    try {
      const { stdout } = await run(process.execPath, [script, '--directory-only'], options);
      return { exitCode: 0, stdout };
    } catch (error) {
      const failure = error as Error & { code?: number; stdout?: string };
      return { exitCode: failure.code, stdout: failure.stdout ?? '' };
    }
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
}

describe('directory production smoke', () => {
  it('accepts the current browsable rows while preserving the full public JSON projection', async () => {
    const result = await smokeWithRows(browsableProjectCount);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('4/4 passed');
  });

  it('rejects an extra row beyond the current browsing projection', async () => {
    const result = await smokeWithRows(browsableProjectCount + 1);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain(
      `expected ${browsableProjectCount} directory rows, got ${browsableProjectCount + 1}`
    );
  });

  it('still requires the complete public JSON projection', async () => {
    const result = await smokeWithRows(browsableProjectCount, publicProjects.slice(0, -1));
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain('directory IDs differ');
  });
});
