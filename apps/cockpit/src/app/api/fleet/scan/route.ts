import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const cockpitPath = process.cwd();
const rootPath = path.resolve(cockpitPath, '../..');
const manifestPath = path.join(rootPath, 'foundry.projects.json');

export async function GET() {
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_FLEET_SCAN) {
    return NextResponse.json({ error: 'Fleet scanning is only available locally' }, { status: 403 });
  }

  try {
    const desktopPath = path.resolve(rootPath, '..');
    const entries = fs.readdirSync(desktopPath, { withFileTypes: true });
    
    // Load Manifest
    let manifest: Record<string, string> = {};
    if (fs.existsSync(manifestPath)) {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    }

    const projects = [];

    // Check fallow
    let hasFallow = false;
    try { execSync('command -v fallow', { stdio: 'pipe' }); hasFallow = true; } catch {}

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'saas-maker') continue;

        const projectPath = path.join(desktopPath, entry.name);
        const foundryConfig = path.join(projectPath, 'foundry.json');
        const pkgPath = path.join(projectPath, 'package.json');

        if (fs.existsSync(foundryConfig)) {
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

          if (hasFallow) {
            try { execSync('fallow check --quiet', { cwd: projectPath, stdio: 'pipe' }); checks.health = true; } catch {}
          }

          projects.push({
            name: pkg.name || entry.name,
            description: manifest[entry.name] || manifest[pkg.name] || "",
            path: projectPath,
            slug: entry.name,
            type: pkg.dependencies?.next ? 'next' : pkg.dependencies?.vite ? 'vite' : 'node',
            compliance: { score: Object.values(checks).filter(Boolean).length, total: 6, checks },
            lastModified: fs.statSync(projectPath).mtime,
          });
        }
      }
    }

    return NextResponse.json({ 
      fleet: projects.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime()),
      count: projects.length,
      manifest // Send full manifest for editing
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to scan fleet', detail: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { manifest } = body;
    if (!manifest) return NextResponse.json({ error: 'Manifest is required' }, { status: 400 });

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update manifest', detail: String(err) }, { status: 500 });
  }
}
