import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

export async function GET() {
  // Only allow scanning in development / local environments
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_FLEET_SCAN) {
    return NextResponse.json({ error: 'Fleet scanning is only available locally' }, { status: 403 });
  }

  try {
    // Current directory is apps/cockpit
    // We want to look at the root directory's siblings
    const cockpitPath = process.cwd();
    const rootPath = path.resolve(cockpitPath, '../..'); // saas-maker root
    const desktopPath = path.resolve(rootPath, '..'); // ~/Desktop

    const entries = fs.readdirSync(desktopPath, { withFileTypes: true });
    const projects = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const projectPath = path.join(desktopPath, entry.name);
        const foundryConfig = path.join(projectPath, 'foundry.json');
        const legacyConfig = path.join(projectPath, '.saasmaker.json');
        const pkgPath = path.join(projectPath, 'package.json');

        const isFoundry = fs.existsSync(foundryConfig) || fs.existsSync(legacyConfig);
        
        if (isFoundry) {
          let pkg: any = {};
          if (fs.existsSync(pkgPath)) {
            try {
              pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            } catch {}
          }

          projects.push({
            name: pkg.name || entry.name,
            path: projectPath,
            slug: entry.name,
            type: pkg.dependencies?.next ? 'next' : pkg.dependencies?.vite ? 'vite' : 'node',
            isLegacy: fs.existsSync(legacyConfig) && !fs.existsSync(foundryConfig),
            lastModified: fs.statSync(projectPath).mtime,
          });
        }
      }
    }

    return NextResponse.json({ 
      fleet: projects.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime()),
      count: projects.length 
    });
  } catch (err) {
    return NextResponse.json({ 
      error: 'Failed to scan fleet', 
      detail: err instanceof Error ? err.message : String(err) 
    }, { status: 500 });
  }
}
