#!/usr/bin/env node
// Manage agent writer worktrees, pinned-pnpm installs and bounded commands.
// Private state stays outside repositories; cleanup is dry-run and close is reversible.
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { AgentWorkspaces, GiB, inventory } from '../lib/agent-workspaces.mjs';

const help = `fleet-workspace <command> [options]
  create --id <id> --repo <path> --owner <agent> --task <task> [--base HEAD]
  heartbeat --id <id>
  status
  install (--id <id> | --repo <path>) [--offline]
  lockfile-only --id <id>        Update an existing pnpm lockfile without installing.
  run (--id <id> | --repo <path>) -- <command> [args...]
  close --id <id> [--dry-run] [--landed <sha>]
                                   Check source and open files; retire reversibly.
                                   Squash-landed branches pass when their changed
                                   paths match the remote default branch, or with
                                   --landed naming the commit that landed them.
  reconcile [--dry-run]           Mark records whose folder is gone as missing.
  gc --dry-run                    Review managed workspaces; never deletes.
  inventory --path <path>          Read-only legacy checkout/store discovery.
  configure [--store-dir <path>] [--max-writers <n>] [--max-heavy-jobs <n>]
            [--workspace-gib <n>] [--total-gib <n>] [--min-free-gib <n>]
  --root <path>                    Private state override for all commands.
`;

export async function main(argv = process.argv.slice(2)) {
  const divider = argv.indexOf('--');
  const commandArgs = divider < 0 ? [] : argv.slice(divider + 1);
  const input = divider < 0 ? argv : argv.slice(0, divider);
  const { values: opts, positionals } = parseArgs({ args: input, allowPositionals: true, strict: true, options: {
    root: { type: 'string' }, id: { type: 'string' }, repo: { type: 'string' }, owner: { type: 'string' }, task: { type: 'string' },
    base: { type: 'string' }, path: { type: 'string' }, landed: { type: 'string' }, 'store-dir': { type: 'string' },
    'max-writers': { type: 'string' }, 'max-heavy-jobs': { type: 'string' }, 'workspace-gib': { type: 'string' },
    'total-gib': { type: 'string' }, 'min-free-gib': { type: 'string' },
    offline: { type: 'boolean' }, 'dry-run': { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
  } });
  if (opts.help || positionals.length === 0) { console.log(help); return; }
  if (positionals.length !== 1) throw new Error('Expected one command.');
  const manager = new AgentWorkspaces({ root: opts.root ?? process.env.FLEET_AGENT_STATE_DIR });
  let result;
  switch (positionals[0]) {
    case 'create': result = await manager.create(opts); break;
    case 'heartbeat': result = await manager.heartbeat(opts.id); break;
    case 'status': result = manager.status(); break;
    case 'install': result = await manager.install(opts); break;
    case 'lockfile-only': result = await manager.lockfileOnly(opts); break;
    case 'run': result = await manager.run({ ...opts, argv: commandArgs }); break;
    case 'close': result = await manager.close(opts.id, { dryRun: opts['dry-run'], landed: opts.landed }); break;
    case 'reconcile': result = await manager.reconcile({ dryRun: opts['dry-run'] }); break;
    case 'gc':
      if (!opts['dry-run']) throw new Error('Only gc --dry-run is supported; no automatic deletion.');
      result = manager.gc(); break;
    case 'inventory':
      if (!opts.path) throw new Error('inventory requires --path.');
      result = inventory(opts.path); break;
    case 'configure': {
      const patch = {};
      if (opts['store-dir']) patch.storeDir = resolve(opts['store-dir']);
      for (const [flag, key, multiplier] of [
        ['max-writers', 'maxWriters', 1], ['max-heavy-jobs', 'maxHeavyJobs', 1],
        ['workspace-gib', 'maxWorkspaceBytes', GiB], ['total-gib', 'maxTotalBytes', GiB], ['min-free-gib', 'minFreeBytes', GiB],
      ]) if (opts[flag] !== undefined) patch[key] = Number(opts[flag]) * multiplier;
      result = await manager.configure(patch); break;
    }
    default: throw new Error(help);
  }
  console.log(JSON.stringify(result, null, 2));
  if (result?.exitCode) process.exitCode = result.exitCode;
  return result;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
