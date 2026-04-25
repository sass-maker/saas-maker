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
      if (entry.isDirectory()) {
        // Skip hidden folders and common noise
        if (entry.name.startsWith('.') || ['node_modules', 'dist', 'out', 'build'].includes(entry.name)) continue;
        
        // IMPORTANT: Skip the factory itself to keep the audit clean
        if (entry.name === 'saas-maker') continue;

        const projectPath = path.join(dirPath, entry.name);
        const foundryConfig = path.join(projectPath, 'foundry.json');
        const legacyConfig = path.join(projectPath, '.saasmaker.json');
        const pkgPath = path.join(projectPath, 'package.json');

        const isFoundry = fs.existsSync(foundryConfig) || fs.existsSync(legacyConfig);
        const hasPkg = fs.existsSync(pkgPath);

        if (isFoundry || hasPkg) {
          let pkg: any = {};
          if (hasPkg) {
            try {
              pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            } catch {}
          }

          fleet.push({
            name: pkg.name || entry.name,
            path: projectPath,
            slug: entry.name,
            type: pkg.dependencies?.next ? 'next' : pkg.dependencies?.vite ? 'vite' : 'node',
            isFoundry: fs.existsSync(foundryConfig),
          });
        }
        
        // Always deep scan for monorepos, but stop if we already found a project at this level
        // (unless it's a known monorepo folder like 'agentMode')
        if (!isFoundry || entry.name === 'agentMode') {
          fleet.push(...scanDir(projectPath, depth + 1));
        }
      }
    }
    return fleet;
  } catch {
    return [];
  }
}

export function getLocalFleet(): FleetProject[] {
  const rootPath = process.cwd();
  // Assume root is ~/Desktop/saas-maker/... so parent is ~/Desktop
  // This logic works regardless of where the CLI is called from within saas-maker
  const desktopPath = rootPath.includes('saas-maker') 
    ? path.resolve(rootPath.split('saas-maker')[0])
    : path.resolve(rootPath, '..');
  
  const rawFleet = scanDir(desktopPath);
  const seen = new Set<string>();
  
  // Filter out the saas-maker internal packages that might have been caught
  return rawFleet.filter(p => {
    if (seen.has(p.path) || p.path.includes('saas-maker/packages') || p.path.includes('saas-maker/apps')) return false;
    seen.add(p.path);
    return true;
  });
}
