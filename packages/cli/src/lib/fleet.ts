import fs from 'node:fs';
import path from 'node:path';

export interface FleetProject {
  name: string;
  path: string;
  slug: string;
  type: 'next' | 'vite' | 'node';
  isFoundry: boolean;
}

const IGNORED_PROJECT_DIRS = new Set([
  'Archived',
  'Fleet',
  'back-propogate',
  'chess',
  'clash-royale-meta',
  'dev_learning',
  'dev-learning',
  'ludo',
  'node_modules',
  'out',
  'personalsite',
  'port-whisperer',
  'reference',
  'reel-maker',
  'sarthak-blog',
  'vaulthealth',
]);

function findFleetRoot(rootPath: string) {
  let cursor = path.resolve(rootPath);
  while (true) {
    if (path.basename(cursor).toLowerCase() === 'fleet') return cursor;
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }

  return path.resolve(rootPath, '..');
}

function scanDir(dirPath: string, depth = 0): FleetProject[] {
  if (depth > 2) return [];
  
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const fleet: FleetProject[] = [];

    for (const entry of entries) {
      if (entry.isDirectory() || entry.isSymbolicLink()) {
        const name = entry.name;
        
        if (name.startsWith('.') ||
            name.startsWith('_') ||
            name === 'dist' ||
            name === 'build' ||
            IGNORED_PROJECT_DIRS.has(name)) continue;
        
        if (name === 'saas-maker') continue;

        // Resolve real path to handle symlinks correctly
        const rawPath = path.join(dirPath, name);
        const projectPath = fs.realpathSync(rawPath);
        
        const foundryConfig = path.join(projectPath, 'foundry.json');
        const pkgPath = path.join(projectPath, 'package.json');

        const isFoundry = fs.existsSync(foundryConfig);
        const hasPkg = fs.existsSync(pkgPath);

        if (isFoundry || (hasPkg && depth === 0)) {
          let pkg: any = {};
          if (hasPkg) {
            try { pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')); } catch {}
          }

          const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
          fleet.push({
            name: pkg.name || name,
            path: projectPath,
            slug: name,
            type: allDeps.next ? 'next' : allDeps.vite ? 'vite' : 'node',
            isFoundry,
          });
          
          if (name !== 'agentMode') continue;
        }
        
        fleet.push(...scanDir(projectPath, depth + 1));
      }
    }
    return fleet;
  } catch {
    return [];
  }
}

export function getLocalFleet(): FleetProject[] {
  const rootPath = process.cwd();
  const fleetPath = findFleetRoot(rootPath);
  
  if (!fs.existsSync(fleetPath)) return [];

  const rawFleet = scanDir(fleetPath);
  const seen = new Set<string>();
  
  return rawFleet.filter(p => {
    if (seen.has(p.path)) return false;
    seen.add(p.path);
    return true;
  });
}
