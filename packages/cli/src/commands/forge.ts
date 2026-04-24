import { createInterface } from 'node:readline/promises';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import ora from 'ora';
import { getResponseError, requestApi } from '../lib/request.js';
import { saveLocalConfig } from '../lib/config.js';
import { log } from '../lib/ui.js';
import { applyStandard, scaffoldRenovate } from '../lib/forge.js';

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

export async function forgeCommand(options: ForgeOptions = {}): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    const inputName = options.name ?? await rl.question('Project name: ');
    const name = inputName.trim();
    if (!name) {
      log.error('Project name cannot be empty.');
      return;
    }

    const type = (options.type ?? (await rl.question('Project type (next | vite | node) [node]: ')).trim() || 'node') as 'next' | 'vite' | 'node';

    // 1. Create in Cockpit
    const spinner = ora('Creating project in cockpit...').start();
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

    // 2. Scaffold Local Directory
    const targetDir = join(process.cwd(), project.slug);
    spinner.start(`Forging project directory at ./${project.slug}...`);
    
    mkdirSync(targetDir, { recursive: true });
    
    // Initial package.json
    const pkg = {
      name: project.slug,
      version: '0.1.0',
      private: true,
      type: 'module',
      scripts: {
        "dev": type === 'next' ? "next dev" : type === 'vite' ? "vite" : "node src/index.js",
        "build": type === 'next' ? "next build" : type === 'vite' ? "tsc && vite build" : "tsc",
        "lint": "eslint ."
      },
      dependencies: type === 'next' ? { "next": "latest", "react": "latest", "react-dom": "latest" } : type === 'vite' ? { "vite": "latest" } : {}
    };
    
    writeFileSync(join(targetDir, 'package.json'), JSON.stringify(pkg, null, 2));
    
    // Create foundry.json
    writeFileSync(join(targetDir, 'foundry.json'), JSON.stringify({
      slug: project.slug,
      projectId: project.id,
      projectKey: project.api_key
    }, null, 2));

    // Apply standards
    applyStandard(type, targetDir);
    scaffoldRenovate(targetDir);

    spinner.succeed('Project forged successfully!');

    console.log(`\n📂 Created project at ./${project.slug}`);
    console.log(`🚀 Next steps:`);
    console.log(`  1. cd ${project.slug}`);
    console.log(`  2. pnpm install`);
    console.log(`  3. foundry login (if not already logged in)`);
  } catch (err) {
    log.error(err instanceof Error ? err.message : 'Forge failed');
  } finally {
    rl.close();
  }
}
