/**
 * @saas-maker/wrangler-preset
 *
 * Foundry-standard Wrangler config builder. Bakes in:
 *  - Latest compatibility_date
 *  - Observability enabled
 *  - Sensible defaults for assets, AI, D1, R2 based on opts.bindings
 *
 * Output is a `wrangler.jsonc`-compatible object that can be JSON-stringified
 * directly, or spread into an existing config.
 */

export { FOUNDRY_COMPATIBILITY_DATE } from './constants.js';
import { FOUNDRY_COMPATIBILITY_DATE } from './constants.js';

export interface D1BindingOpts {
  binding: string;
  database_name: string;
  database_id: string;
  migrations_dir?: string;
}

export interface R2BindingOpts {
  binding: string;
  bucket_name: string;
}

export interface KVBindingOpts {
  binding: string;
  id: string;
}

export interface AssetsBindingOpts {
  directory: string;
  binding?: string;
  not_found_handling?: 'single-page-application' | '404-page' | 'none';
}

export interface AIBindingOpts {
  binding?: string;
}

export interface WranglerBindings {
  ai?: boolean | AIBindingOpts;
  d1_databases?: D1BindingOpts[];
  r2_buckets?: R2BindingOpts[];
  kv_namespaces?: KVBindingOpts[];
  assets?: AssetsBindingOpts;
}

export interface DefineWranglerOpts {
  /** Worker / Pages project name. */
  name: string;
  /** Entrypoint script. Default: 'src/index.ts'. */
  main?: string;
  /** Cloudflare account id (optional, usually pulled from env). */
  account_id?: string;
  /** Compatibility date. Defaults to FOUNDRY_COMPATIBILITY_DATE. */
  compatibility_date?: string;
  /** Compatibility flags. nodejs_compat is opt-in. */
  compatibility_flags?: string[];
  /** Bindings to wire up. */
  bindings?: WranglerBindings;
  /** Plain env vars (non-secret). */
  vars?: Record<string, string>;
  /** Custom routes. */
  routes?: Array<{ pattern: string; zone_name?: string; custom_domain?: boolean }>;
  /** Workers logs / observability. Default: true. */
  observability?: boolean;
  /** Override or extend the resulting object before return. */
  extend?: Record<string, unknown>;
}

export interface WranglerConfig {
  name: string;
  main?: string;
  account_id?: string;
  compatibility_date: string;
  compatibility_flags?: string[];
  observability: { enabled: boolean };
  vars?: Record<string, string>;
  routes?: Array<{ pattern: string; zone_name?: string; custom_domain?: boolean }>;
  ai?: { binding: string };
  assets?: AssetsBindingOpts;
  d1_databases?: D1BindingOpts[];
  r2_buckets?: R2BindingOpts[];
  kv_namespaces?: KVBindingOpts[];
  [key: string]: unknown;
}

/**
 * Build a Foundry-standard wrangler.jsonc-compatible object.
 *
 * @example
 * ```ts
 * import { defineWrangler } from '@saas-maker/wrangler-preset';
 *
 * export default defineWrangler({
 *   name: 'my-api',
 *   main: 'src/index.ts',
 *   bindings: {
 *     ai: true,
 *     d1_databases: [{ binding: 'DB', database_name: 'app', database_id: 'xxx' }],
 *   },
 * });
 * ```
 */
export function defineWrangler(opts: DefineWranglerOpts): WranglerConfig {
  const {
    name,
    main = 'src/index.ts',
    account_id,
    compatibility_date = FOUNDRY_COMPATIBILITY_DATE,
    compatibility_flags,
    bindings = {},
    vars,
    routes,
    observability = true,
    extend = {},
  } = opts;

  const config: WranglerConfig = {
    name,
    main,
    compatibility_date,
    observability: { enabled: observability },
  };

  if (account_id) config.account_id = account_id;
  if (compatibility_flags && compatibility_flags.length) {
    config.compatibility_flags = compatibility_flags;
  }
  if (vars && Object.keys(vars).length) config.vars = vars;
  if (routes && routes.length) config.routes = routes;

  if (bindings.ai) {
    const ai = typeof bindings.ai === 'object' ? bindings.ai : {};
    config.ai = { binding: ai.binding ?? 'AI' };
  }

  if (bindings.assets) {
    config.assets = {
      not_found_handling: 'single-page-application',
      ...bindings.assets,
    };
  }

  if (bindings.d1_databases?.length) {
    config.d1_databases = bindings.d1_databases.map((d) => ({
      migrations_dir: 'migrations',
      ...d,
    }));
  }

  if (bindings.r2_buckets?.length) config.r2_buckets = bindings.r2_buckets;
  if (bindings.kv_namespaces?.length) config.kv_namespaces = bindings.kv_namespaces;

  return { ...config, ...extend };
}

export * as snippets from './snippets.js';
