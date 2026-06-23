import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export interface ProjectTooling {
  slug: string;
  name: string;
  path: string;
  framework: string;
  frameworkVersion: string;
  db: string;
  auth: string;
  deploy: string;
  testFrameworks: string;
  saasmakerCount: number;
  foundryLinked: boolean;
  lastScanned: string;
}

export function detectTooling(projectPath: string, slug: string): ProjectTooling {
  const pkgPath = join(projectPath, 'package.json');
  const foundryPath = join(projectPath, 'foundry.json');

  let pkg: any = {};
  let name = slug;
  if (existsSync(pkgPath)) {
    try {
      pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      name = pkg.name || slug;
    } catch {}
  }

  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const scripts = pkg.scripts ?? {};
  const scriptText = Object.values(scripts).join(' ');
  const majorVersion = (value: unknown) => {
    if (typeof value !== 'string') return '';
    return value.replace(/[\^~>=<]/g, '').split('.')[0];
  };

  // Framework
  let framework = '-';
  let frameworkVersion = '';
  if (deps.next) {
    framework = 'Next.js';
    frameworkVersion = majorVersion(deps.next);
  } else if (deps['@remotion/cli']) {
    framework = 'Remotion';
    frameworkVersion = majorVersion(deps['@remotion/cli']);
  } else if (deps.astro) {
    framework = 'Astro';
    frameworkVersion = majorVersion(deps.astro);
  } else if (deps.vite) {
    framework = 'Vite';
    frameworkVersion = majorVersion(deps.vite);
  } else if (existsSync(pkgPath)) {
    framework = 'Node';
    frameworkVersion = majorVersion(pkg.engines?.node);
  }

  // DB
  const dbParts: string[] = [];
  if (deps['@libsql/client']) dbParts.push('Turso');
  if (deps['drizzle-orm']) dbParts.push('Drizzle');
  if (deps.firebase || deps['firebase-admin']) dbParts.push('Firebase');
  if (deps['@prisma/client']) dbParts.push('Prisma');
  if (deps['better-sqlite3']) dbParts.push('SQLite');
  const db = dbParts.join('+') || '-';

  // Auth
  const authParts: string[] = [];
  if (deps['next-auth']) {
    const v = deps['next-auth'];
    authParts.push(v.includes('beta') ? 'NextAuth v5β' : 'NextAuth v4');
  }
  if (deps['better-auth']) authParts.push('BetterAuth');
  if (deps['@clerk/nextjs']) authParts.push('Clerk');
  const auth = authParts.join('+') || '-';

  // Deploy
  const deployParts: string[] = [];
  if (
    deps.wrangler ||
    existsSync(join(projectPath, 'wrangler.toml')) ||
    existsSync(join(projectPath, 'wrangler.json')) ||
    existsSync(join(projectPath, 'wrangler.jsonc')) ||
    scriptText.includes('wrangler')
  )
    deployParts.push('CF');
  if (deps['@tauri-apps/cli']) deployParts.push('Tauri');
  const deploy = deployParts.join('+') || '?';

  // Tests
  const testParts: string[] = [];
  if (deps.vitest) testParts.push('Vitest');
  if (
    deps['@playwright/test'] ||
    existsSync(join(projectPath, 'playwright.config.ts')) ||
    existsSync(join(projectPath, 'playwright.config.js'))
  )
    testParts.push('PW');
  if (deps.jest) testParts.push('Jest');
  const testFrameworks = testParts.join('+') || '-';

  // SAAS Maker
  const saasmakerCount = Object.keys(deps).filter((k) => k.startsWith('@saas-maker/')).length;

  return {
    slug,
    name,
    path: projectPath,
    framework,
    frameworkVersion: frameworkVersion ? `${framework} ${frameworkVersion}` : framework,
    db,
    auth,
    deploy,
    testFrameworks,
    saasmakerCount,
    foundryLinked: existsSync(foundryPath),
    lastScanned: new Date().toISOString(),
  };
}
