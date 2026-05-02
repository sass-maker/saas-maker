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
