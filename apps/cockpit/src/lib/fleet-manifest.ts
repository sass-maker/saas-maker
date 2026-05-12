import fs from 'node:fs';
import path from 'node:path';

interface ManifestEntry {
  desc?: string;
  url?: string;
}

const MANIFEST_PATH = path.resolve(process.cwd(), '..', '..', 'foundry.projects.json');

export function getManifestProjectSlugs() {
  try {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8')) as Record<string, ManifestEntry>;
    return Object.keys(manifest).sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

export function getManifestProjectRepos() {
  try {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8')) as Record<string, ManifestEntry>;
    return Object.fromEntries(
      Object.entries(manifest)
        .filter((entry): entry is [string, ManifestEntry & { url: string }] => typeof entry[1].url === 'string' && entry[1].url.trim().length > 0)
        .map(([slug, entry]) => [slug, normalizeRepoUrl(entry.url)])
    );
  } catch {
    return {};
  }
}

function normalizeRepoUrl(url: string) {
  const match = url.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/);
  if (!match) return url;
  return `https://github.com/${match[1]}/${match[2]}.git`;
}
