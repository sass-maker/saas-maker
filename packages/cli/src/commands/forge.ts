import { createInterface } from 'node:readline/promises';
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ora from 'ora';
import { getResponseError, requestApi } from '../lib/request.js';
import { log } from '../lib/ui.js';
import { scaffoldRenovate, scaffoldCI, scaffoldHusky } from '../lib/forge.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

interface Project {
  id: string;
  name: string;
  slug: string;
  api_key: string;
}

interface ForgeOptions {
  name?: string;
  type?: 'next' | 'vite' | 'node';
}

function copyRecursive(src: string, dest: string, vars: Record<string, string>) {
  if (statSync(src).isDirectory()) {
    if (!existsSync(dest)) mkdirSync(dest, { recursive: true });
    readdirSync(src).forEach((child) => copyRecursive(join(src, child), join(dest, child), vars));
  } else {
    let content = readFileSync(src, 'utf-8');
    Object.entries(vars).forEach(([key, val]) => {
      content = content.replace(new RegExp(`{{${key}}}`, 'g'), val);
    });
    const finalDest = dest.replace('.tmpl', '');
    writeFileSync(finalDest, content);
  }
}

export async function forgeCommand(options: ForgeOptions = {}): Promise<void> {
  // Early check for session token
  try {
    const token = await requestApi({ path: '/v1/auth/whoami', auth: 'session' });
    if (!token.ok) {
      log.error('Not logged in. Please run `fnd login` first.');
      return;
    }
  } catch (_e) {
    log.error('Authentication check failed. Please ensure you are logged in.');
    return;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    log.info('Preparing to forge project...');
    const inputName = options.name ?? (await rl.question('Project name: '));
    const name = inputName.trim();
    if (!name) {
      log.error('Project name cannot be empty.');
      return;
    }

    const typeInput =
      options.type ?? (await rl.question('Project type (next | vite | node) [node]: ')).trim();
    const type = (typeInput || 'node') as 'next' | 'vite' | 'node';

    // 1. Create in Cockpit
    const spinner = ora('Creating project in cockpit...').start();
    log.debug('Requesting project creation...');
    const res = await requestApi<Project>({
      path: '/v1/projects',
      method: 'POST',
      auth: 'session',
      body: { name },
    });

    if (!res.ok || !res.data) {
      spinner.stop();
      log.error(getResponseError(res));
      return;
    }
    const project = res.data;
    spinner.succeed(`Created "${project.name}" in cockpit.`);

    // 2. Scaffold from Template
    const targetDir = join(process.cwd(), project.slug);
    const templateDir = resolve(__dirname, '../../templates', type);

    spinner.start(`Forging ${type} project at ./${project.slug}...`);
    log.debug(`Template dir: ${templateDir}`);
    log.debug(`Target dir: ${targetDir}`);

    mkdirSync(targetDir, { recursive: true });

    // Copy template files
    log.debug('Copying files...');
    copyRecursive(templateDir, targetDir, { name: project.slug });

    // Create foundry.json
    log.debug('Writing foundry.json...');
    writeFileSync(
      join(targetDir, 'foundry.json'),
      JSON.stringify(
        {
          slug: project.slug,
          projectId: project.id,
          projectKey: project.api_key,
        },
        null,
        2
      )
    );

    log.debug('Scaffolding renovate...');
    scaffoldRenovate(targetDir);

    log.debug('Scaffolding CI...');
    scaffoldCI(targetDir);

    log.debug('Scaffolding Husky...');
    scaffoldHusky(targetDir);

    // 3. Register in Global Manifest
    try {
      log.debug('Updating global manifest...');
      const manifestPath = resolve(__dirname, '../../../../foundry.projects.json');
      if (existsSync(manifestPath)) {
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
        manifest[project.slug] = `Newly forged ${type} project.`;
        writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        log.success('✓ Registered in Foundry Manifest');
      }
    } catch (_e) {
      log.warn('Failed to update manifest, please add manually.');
    }

    spinner.succeed('Project forged successfully!');

    console.log(`\n📂 Created project at ./${project.slug}`);
    console.log(`🚀 Next steps:`);
    console.log(`  1. cd ${project.slug}`);
    console.log(`  2. pnpm install`);
    console.log(`  3. fnd login (if not already logged in)`);
  } catch (err) {
    log.error(err instanceof Error ? err.message : 'Forge failed');
  } finally {
    rl.close();
  }
}
