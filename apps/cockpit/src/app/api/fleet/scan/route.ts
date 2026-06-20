import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { isHiddenDashboardProject } from '@/lib/dashboard-projects';
import { buildFleetCommandCenter } from '@/lib/fleet-health';
import type { FleetHealthProject } from '@/lib/fleet-health';

const cockpitPath = process.cwd();
const rootPath = path.resolve(cockpitPath, '../..');
const manifestPath = path.join(rootPath, 'foundry.projects.json');

export async function GET() {
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_FLEET_SCAN) {
    return NextResponse.json(
      { error: 'Fleet scanning is only available locally' },
      { status: 403 }
    );
  }

  try {
    const desktopPath = path.resolve(rootPath, '..');
    const entries = fs.readdirSync(desktopPath, { withFileTypes: true });

    // Load Manifest
    let manifest: Record<string, { desc?: string; url?: string; tier?: string }> = {};
    if (fs.existsSync(manifestPath)) {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    }

    const projects = [];

    // Check fallow
    let hasFallow = false;
    try {
      execSync('command -v fallow', { stdio: 'pipe' });
      hasFallow = true;
    } catch {}

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (
          entry.name.startsWith('.') ||
          entry.name === 'node_modules' ||
          !(entry.name in manifest) ||
          isHiddenDashboardProject({ name: entry.name, slug: entry.name })
        )
          continue;

        const projectPath = path.join(desktopPath, entry.name);
        const foundryConfig = path.join(projectPath, 'foundry.json');
        const pkgPath = path.join(projectPath, 'package.json');

        let pkg: any = {};
        if (fs.existsSync(pkgPath)) {
          try {
            pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
          } catch {}
        }

        if (isHiddenDashboardProject({ name: pkg.name || entry.name, slug: entry.name })) continue;

        const checks = {
          config: fs.existsSync(foundryConfig),
          eslint: fs.existsSync(path.join(projectPath, 'eslint.config.js')),
          tsconfig: fs.existsSync(path.join(projectPath, 'tsconfig.json')),
          prettier:
            fs.existsSync(path.join(projectPath, '.prettierrc.json')) ||
            fs.existsSync(path.join(projectPath, '.prettierrc')) ||
            typeof pkg.prettier === 'object',
          ci: fs.existsSync(path.join(projectPath, '.github/workflows/ci.yml')),
          health: false,
        };

        if (hasFallow) {
          try {
            execSync('fallow check --quiet', { cwd: projectPath, stdio: 'pipe' });
            checks.health = true;
          } catch {}
        }

        const projectType: FleetHealthProject['type'] = pkg.dependencies?.next
          ? 'next'
          : pkg.dependencies?.vite
            ? 'vite'
            : 'node';

        projects.push({
          name: pkg.name || entry.name,
          description: manifest[entry.name]?.desc || '',
          path: projectPath,
          slug: entry.name,
          type: projectType,
          isLegacy: !checks.config || !checks.ci,
          compliance: { score: Object.values(checks).filter(Boolean).length, total: 6, checks },
          lastModified: fs.statSync(projectPath).mtime,
        });
      }
    }

    const fleet = projects.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
    const commandCenter = buildFleetCommandCenter(fleet);

    return NextResponse.json({
      fleet,
      count: projects.length,
      health: commandCenter.health,
      commandCenter,
      manifest, // Send full manifest for editing
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to scan fleet', detail: String(err) },
      { status: 500 }
    );
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
    return NextResponse.json(
      { error: 'Failed to update manifest', detail: String(err) },
      { status: 500 }
    );
  }
}
