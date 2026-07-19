import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const config = JSON.parse(stripJsonComments(await readFile('wrangler.jsonc', 'utf8')));
const bucket = config.r2_buckets?.find((binding) => binding.binding === 'REEL_ARTIFACTS')?.bucket_name;
if (!bucket) throw new Error('wrangler.jsonc missing REEL_ARTIFACTS R2 binding');

const checks = [];
checks.push(await commandCheck('wrangler whoami', ['wrangler', 'whoami', '--json']));
checks.push(await commandCheck('wrangler r2 bucket list', ['wrangler', 'r2', 'bucket', 'list']));
checks.push(await commandCheck('wrangler deploy dry-run', ['wrangler', 'deploy', '--dry-run']));
checks.push(await commandCheck('wrangler deployments list', ['wrangler', 'deployments', 'list']));

const bucketList = checks[1].stdout;
const bucketExists = bucketList.includes(bucket);
const deploymentExists = /Created:\s+\d{4}-\d{2}-\d{2}/.test(checks[3].stdout);
const ok = checks.every((check) => check.ok) && bucketExists && deploymentExists;

const report = {
  ok,
  bucket,
  bucketExists,
  deploymentExists,
  workerUrl: deploymentExists ? `https://${config.name}.sarthakagrawal927.workers.dev` : null,
  nextActions: nextActions({ bucket, bucketExists, deploymentExists }),
  checks: checks.map(({ name, ok: checkOk, error }) => ({ name, ok: checkOk, error })),
};

console.log(JSON.stringify(report, null, 2));
if (!ok) process.exitCode = 1;

async function commandCheck(name, args) {
  try {
    const { stdout, stderr } = await execFileAsync('npx', args);
    return { name, ok: true, stdout, stderr };
  } catch (error) {
    return {
      name,
      ok: false,
      stdout: error.stdout ?? '',
      stderr: error.stderr ?? '',
      error: error.message,
    };
  }
}

function stripJsonComments(input) {
  return input
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

function nextActions({ bucket, bucketExists, deploymentExists }) {
  const actions = [];
  if (!bucketExists) {
    actions.push(`npm run bootstrap:cloudflare -- --confirm-create-bucket`);
  }
  if (!deploymentExists) {
    actions.push(`npm run bootstrap:cloudflare -- --confirm-deploy`);
  }
  actions.push(`REEL_ARTIFACT_BASE_URL=<deployed-worker-url> REEL_ARTIFACT_SMOKE_KEY=<uploaded-key> npm run smoke:artifact`);
  return actions;
}
