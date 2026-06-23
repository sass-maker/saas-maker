/**
 * GitHub CI/CD status fetcher.
 * Reads `foundry.projects.json` for repo URLs and queries GitHub Actions API.
 *
 * Token resolution order:
 *   1. GH_TOKEN env var
 *   2. GITHUB_TOKEN env var
 *   3. `gh auth token` (gh CLI keyring) — auto-detected on dev machines
 *   4. Anonymous (60 req/h shared IP)
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

export interface CIStatus {
  conclusion: 'success' | 'failure' | 'cancelled' | 'in_progress' | 'unknown';
  workflowName: string;
  ranAt: string | null;
  updatedAt: string | null;
  url: string | null;
  branch: string | null;
}

interface ManifestEntry {
  url: string;
  desc?: string;
}

interface WorkflowRun {
  name: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  head_branch: string;
  run_started_at: string;
  updated_at: string;
}

function resolveToken(): string {
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    const out = execSync('gh auth token', {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return out || '';
  } catch {
    return '';
  }
}

let _tokenCache: string | null = null;
function getToken(): string {
  if (_tokenCache !== null) return _tokenCache;
  _tokenCache = resolveToken();
  return _tokenCache;
}

const MANIFEST_PATH = path.resolve(process.cwd(), '..', '..', 'foundry.projects.json');

let _manifestCache: Record<string, ManifestEntry> | null = null;
function loadManifest(): Record<string, ManifestEntry> {
  if (_manifestCache) return _manifestCache;
  try {
    _manifestCache = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
    return _manifestCache!;
  } catch {
    _manifestCache = {};
    return _manifestCache;
  }
}

function parseRepo(url: string): { owner: string; repo: string } | null {
  // https://github.com/owner/repo.git OR git@github.com:owner/repo.git
  const m = url.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (!m) return null;
  return { owner: m[1], repo: m[2] };
}

function mapConclusion(run: WorkflowRun): CIStatus['conclusion'] {
  if (run.status === 'in_progress' || run.status === 'queued') return 'in_progress';
  switch (run.conclusion) {
    case 'success':
      return 'success';
    case 'failure':
      return 'failure';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'unknown';
  }
}

async function fetchLatestRun(owner: string, repo: string): Promise<CIStatus | null> {
  const url = `https://api.github.com/repos/${owner}/${repo}/actions/runs?per_page=1`;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    const data = (await res.json()) as { workflow_runs?: WorkflowRun[] };
    const run = data.workflow_runs?.[0];
    if (!run) return null;
    return {
      conclusion: mapConclusion(run),
      workflowName: run.name,
      ranAt: run.run_started_at,
      updatedAt: run.updated_at,
      url: run.html_url,
      branch: run.head_branch,
    };
  } catch {
    return null;
  }
}

export async function getFleetCIStatus(slugs: string[]): Promise<Record<string, CIStatus | null>> {
  const manifest = loadManifest();
  const out: Record<string, CIStatus | null> = {};

  await Promise.all(
    slugs.map(async (slug) => {
      const entry = manifest[slug];
      if (!entry) {
        out[slug] = null;
        return;
      }
      const repo = parseRepo(entry.url);
      if (!repo) {
        out[slug] = null;
        return;
      }
      out[slug] = await fetchLatestRun(repo.owner, repo.repo);
    })
  );

  return out;
}
