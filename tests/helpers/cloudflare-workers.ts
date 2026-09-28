/** Minimal test shim; production Workers resolve this from the Cloudflare runtime. */
export class WorkerEntrypoint<Env = Record<string, unknown>> {
  env: Env;

  constructor(_context: unknown, env: Env) {
    this.env = env;
  }
}
