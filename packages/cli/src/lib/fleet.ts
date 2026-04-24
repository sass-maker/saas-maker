import fs from 'node:fs';
import path from 'node:path';

export interface FleetProject {
  name: string;
  path: string;
  slug: string;
  type: 'next' | 'vite' | 'node';
  isFoundry: boolean;
}

export function getLocalFleet(): FleetProject[] {
  try {
    // Navigate from saas-maker/packages/cli/src/lib to ~/Desktop
    // process.cwd() is usually the project root when running via fnd
    const rootPath = process.cwd();
    const desktopPath = path.resolve(rootPath, '..');

    const entries = fs.readdirSync(desktopPath, { withFileTypes: true });
    const fleet: FleetProject[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const projectPath = path.join(desktopPath, entry.name);
        const foundryConfig = path.join(projectPath, 'foundry.json');
        const legacyConfig = path.join(projectPath, '.saasmaker.json');
        const pkgPath = path.join(projectPath, 'package.json');

        if (fs.existsSync(foundryConfig) || fs.existsSync(legacyConfig)) {
          let pkg: any = {};
          if (fs.existsSync(pkgPath)) {
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
      }
    }

    return fleet;
  } catch (err) {
    return [];
  }
}
