import fs from 'node:fs';
import path from 'node:path';

export interface FleetProject {
  name: string;
  path: string;
  slug: string;
  type: 'next' | 'vite' | 'node';
  isFoundry: boolean;
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
            ['node_modules', 'dist', 'out', 'build', 'reference', 'Archived',
              'vaulthealth', 'dev_learning', 'port-whisperer'
            ].includes(name)) continue;
        
        if (name === 'saas-maker' || name === 'Fleet') continue;

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

          fleet.push({
            name: pkg.name || name,
            path: projectPath,
            slug: name,
            type: pkg.dependencies?.next ? 'next' : pkg.dependencies?.vite ? 'vite' : 'node',
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
  // We now strictly scan the Fleet folder as the source of truth
  const rootPath = process.cwd();
  const desktopPath = rootPath.includes('saas-maker') 
    ? path.resolve(rootPath.split('saas-maker')[0])
    : path.resolve(rootPath, '..');
  
  const fleetPath = path.join(desktopPath, 'Fleet');
  if (!fs.existsSync(fleetPath)) return [];

  const rawFleet = scanDir(fleetPath);
  const seen = new Set<string>();
  
  return rawFleet.filter(p => {
    if (seen.has(p.path)) return false;
    seen.add(p.path);
    return true;
  });
}
