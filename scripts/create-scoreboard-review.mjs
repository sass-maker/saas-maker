#!/usr/bin/env node
// Compatibility entrypoint. Private review assembly is owned by Site Health.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { primaryFleetRoot } from './catalog-paths.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const target = join(primaryFleetRoot(root), 'site-health/scripts/create-scoreboard-review.mjs');
if (!existsSync(target)) {
  console.error(
    'Run scripts/create-scoreboard-review.mjs from the current Site Health checkout. Private portfolio review assembly moved there.'
  );
  process.exitCode = 1;
} else {
  const result = spawnSync(process.execPath, [target, ...process.argv.slice(2)], {
    stdio: 'inherit',
  });
  if (result.error) console.error(result.error.message);
  process.exitCode = result.status ?? 1;
}
