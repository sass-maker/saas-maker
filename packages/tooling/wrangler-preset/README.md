# @saas-maker/wrangler-preset

Foundry-standard Wrangler config builder. Bakes the right `compatibility_date`, observability flags, and binding defaults into every Worker so you stop copy-pasting `wrangler.jsonc` snippets between projects.

## Install

```bash
pnpm add -D @saas-maker/wrangler-preset
```

## Usage — Workers

```ts
// wrangler.config.ts
import { defineWrangler } from '@saas-maker/wrangler-preset';

export default defineWrangler({
  name: 'my-api',
  main: 'src/index.ts',
  compatibility_flags: ['nodejs_compat'],
  bindings: {
    ai: true,
    d1_databases: [
      { binding: 'DB', database_name: 'app', database_id: 'xxxx' },
    ],
    r2_buckets: [{ binding: 'UPLOADS', bucket_name: 'uploads' }],
  },
  vars: { LOG_LEVEL: 'info' },
});
```

Wrangler will pick up `wrangler.jsonc` / `wrangler.toml` directly — to use this preset, generate the file:

```ts
// scripts/sync-wrangler.ts
import { writeFileSync } from 'node:fs';
import config from '../wrangler.config.ts';
writeFileSync('wrangler.jsonc', JSON.stringify(config, null, 2));
```

Or call `defineWrangler()` from a build script that emits `wrangler.jsonc` before deploy.

## Usage — Pages / SPA

```ts
import { defineWrangler } from '@saas-maker/wrangler-preset';

export default defineWrangler({
  name: 'marketing-site',
  bindings: {
    assets: { directory: './dist' }, // SPA fallback baked in
  },
});
```

## Snippets

For partial spreading into existing configs:

```ts
import { snippets } from '@saas-maker/wrangler-preset';

export default {
  name: 'legacy-worker',
  main: 'src/index.ts',
  ...snippets.baseDefaults,
  assets: snippets.spaAssets,
  ai: snippets.ai,
};
```

## Defaults

| Option | Default |
|---|---|
| `compatibility_date` | `2025-04-01` (current Foundry baseline) |
| `observability.enabled` | `true` |
| `main` | `src/index.ts` |
| `assets.not_found_handling` | `single-page-application` |
| `d1_databases[].migrations_dir` | `migrations` |
| `bindings.ai.binding` | `AI` |

Pass `observability: false` to opt out. Override anything via `extend: { ... }`.
