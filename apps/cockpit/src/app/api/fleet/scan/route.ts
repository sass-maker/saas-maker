import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

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

    // Check if fallow is available globally
    let hasFallow = false;
    try {
      execSync('command -v fallow', { encoding: 'utf-8', stdio: 'pipe' });
      hasFallow = true;
    } catch {}

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'saas-maker') continue;

        const projectPath = path.join(desktopPath, entry.name);
        const foundryConfig = path.join(projectPath, 'foundry.json');
        const legacyConfig = path.join(projectPath, '.saasmaker.json');
        const pkgPath = path.join(projectPath, 'package.json');

        if (fs.existsSync(foundryConfig) || fs.existsSync(legacyConfig)) {
          let pkg: any = {};
          if (fs.existsSync(pkgPath)) {
            try { pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')); } catch {}
          }

          const checks = {
            config: fs.existsSync(foundryConfig),
            eslint: fs.existsSync(path.join(projectPath, 'eslint.config.js')),
            tsconfig: fs.existsSync(path.join(projectPath, 'tsconfig.json')),
            prettier: pkg.prettier === '@saas-maker/prettier-config',
            ci: fs.existsSync(path.join(projectPath, '.github/workflows/ci.yml')),
            health: false
          };

          // Quick Code Health Check (Fallow)
          if (hasFallow) {
            try {
              execSync('fallow check --quiet', { cwd: projectPath, encoding: 'utf-8', stdio: 'pipe' });
              checks.health = true;
            } catch {}
          }

          const score = Object.values(checks).filter(Boolean).length;

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

    const sortedFleet = projects.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
    const totalScore = projects.reduce((acc, p) => acc + p.compliance.score, 0);
    const maxScore = projects.length * 6; // 6 checks now

    return NextResponse.json({ 
      fleet: sortedFleet,
      count: projects.length,
      health: {
        percentage: maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0,
        compliant: projects.filter(p => p.compliance.score === p.compliance.total).length,
        legacy: projects.filter(p => p.isLegacy).length
      }
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to scan fleet', detail: String(err) }, { status: 500 });
  }
}
