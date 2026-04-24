import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

export async function GET() {
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_FLEET_SCAN) {
    return NextResponse.json({ error: 'Fleet scanning is only available locally' }, { status: 403 });
  }

  try {
    const cockpitPath = process.cwd();
    const rootPath = path.resolve(cockpitPath, '../..');
    const desktopPath = path.resolve(rootPath, '..');

    const entries = fs.readdirSync(desktopPath, { withFileTypes: true });
    const projects = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const projectPath = path.join(desktopPath, entry.name);
        const foundryConfig = path.join(projectPath, 'foundry.json');
        const legacyConfig = path.join(projectPath, '.saasmaker.json');
        const pkgPath = path.join(projectPath, 'package.json');
        const eslintPath = path.join(projectPath, 'eslint.config.js');
        const tsPath = path.join(projectPath, 'tsconfig.json');

        const isFoundry = fs.existsSync(foundryConfig) || fs.existsSync(legacyConfig);
        
        if (isFoundry) {
          let pkg: any = {};
          if (fs.existsSync(pkgPath)) {
            try {
              pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            } catch {}
          }

          // Calculate Compliance Score
          let score = 0;
          const checks = {
            config: fs.existsSync(foundryConfig),
            eslint: false,
            tsconfig: false,
            prettier: pkg.prettier === '@saas-maker/prettier-config',
          };

          if (fs.existsSync(eslintPath)) {
            const content = fs.readFileSync(eslintPath, 'utf-8');
            checks.eslint = content.includes('@saas-maker/eslint-config');
          }
          if (fs.existsSync(tsPath)) {
            const content = fs.readFileSync(tsPath, 'utf-8');
            checks.tsconfig = content.includes('@saas-maker/tsconfig');
          }

          score = Object.values(checks).filter(Boolean).length;

          projects.push({
            name: pkg.name || entry.name,
            path: projectPath,
            slug: entry.name,
            type: pkg.dependencies?.next ? 'next' : pkg.dependencies?.vite ? 'vite' : 'node',
            compliance: {
              score,
              total: Object.keys(checks).length,
              checks
            },
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
    return NextResponse.json({ error: 'Failed to scan fleet', detail: String(err) }, { status: 500 });
  }
}
