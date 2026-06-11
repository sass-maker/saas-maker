import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const args = parseArgs(process.argv.slice(2));
const config = JSON.parse(stripJsonComments(await readFile('wrangler.jsonc', 'utf8')));
const bucket = config.r2_buckets?.find((binding) => binding.binding === 'REEL_ARTIFACTS')?.bucket_name;
if (!bucket) throw new Error('wrangler.jsonc missing REEL_ARTIFACTS R2 binding');

const actions = [];
await run('wrangler whoami', ['wrangler', 'whoami', '--json']);

const { stdout: bucketList } = await run('wrangler r2 bucket list', ['wrangler', 'r2', 'bucket', 'list']);
const bucketExists = bucketList.includes(bucket);

if (!bucketExists) {
  if (!parseBool(args.confirmCreateBucket ?? args['confirm-create-bucket'])) {
    actions.push({ action: 'create-bucket', skipped: true, reason: 'missing --confirm-create-bucket', bucket });
  } else {
    await run(`wrangler r2 bucket create ${bucket}`, ['wrangler', 'r2', 'bucket', 'create', bucket]);
    actions.push({ action: 'create-bucket', skipped: false, bucket });
  }
} else {
  actions.push({ action: 'create-bucket', skipped: true, reason: 'bucket already exists', bucket });
}

if (parseBool(args.confirmDeploy ?? args['confirm-deploy'])) {
  await run('wrangler deploy', ['wrangler', 'deploy']);
  actions.push({ action: 'deploy-worker', skipped: false, worker: config.name });
} else {
  await run('wrangler deploy dry-run', ['wrangler', 'deploy', '--dry-run']);
  actions.push({ action: 'deploy-worker', skipped: true, reason: 'dry-run only; pass --confirm-deploy', worker: config.name });
}

console.log(JSON.stringify({ ok: true, bucket, worker: config.name, actions }, null, 2));

async function run(name, wranglerArgs) {
  try {
    const result = await execFileAsync('npx', wranglerArgs);
    return result;
  } catch (error) {
    throw new Error(`${name} failed: ${error.stderr || error.stdout || error.message}`);
  }
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function parseBool(value) {
  if (value === undefined || value === null || value === '') return false;
  if (value === true) return true;
  const normalized = String(value).trim().toLowerCase();
  return ['1', 'true', 'yes', 'y', 'on'].includes(normalized);
}

function stripJsonComments(input) {
  return input
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}
