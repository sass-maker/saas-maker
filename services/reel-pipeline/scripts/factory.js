#!/usr/bin/env node
import { planIdeas, produceNext, factoryStatus } from '../src/studio/factory.js';

const USAGE = `Usage: npm run factory -- <command> [flags]

Commands:
  plan     --niche <niche> [--count N]     Fill the backlog with ideas
  produce  [--count N] [--engine kokoro|moneyprinterturbo|mock]
           [--duration S] [--out DIR]      Render the next N backlog ideas
  status                                    Pipeline counts + recent renders

The conveyor: plan → produce → review renders at /studio → post.
Produce defaults to the kokoro engine (fully local).`;

function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      flags[key] = true;
    } else {
      flags[key] = next;
      i += 1;
    }
  }
  return flags;
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);
  if (!command || command === 'help' || flags.help) {
    console.log(USAGE);
    return;
  }
  if (command === 'plan') {
    const result = await planIdeas({ niche: flags.niche, count: flags.count ? Number(flags.count) : undefined });
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (command === 'produce') {
    const result = await produceNext({
      count: flags.count ? Number(flags.count) : 1,
      engine: typeof flags.engine === 'string' ? flags.engine : 'kokoro',
      durationSeconds: flags.duration ? Number(flags.duration) : undefined,
      outputDir: typeof flags.out === 'string' ? flags.out : undefined,
    });
    console.log(JSON.stringify(result, null, 2));
    if (result.failed > 0) process.exit(1);
    return;
  }
  if (command === 'status') {
    console.log(JSON.stringify(await factoryStatus({}), null, 2));
    return;
  }
  throw new Error(`unknown command: ${command}\n\n${USAGE}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
