# Fleet AI client standard

**Status: ratified 2026-08-30 on issue #61; gateway policy revised 2026-10-09.**

Every Fleet product calls models through the shared Free AI gateway
(`free-ai`). Requests use `model: "auto"` unless the product needs an exact
model, and every request sends the product's project id (`project_id` in the
body or the `X-Gateway-Project-Id` header) so usage and rate accounting stay
per product. Shared tooling owns only the credential-free audit and exact
client pins.

## Runtime contract

JavaScript and TypeScript model callers use:

- `ai@6.0.168`;
- `@ai-sdk/openai-compatible@2.0.41` when a maintained provider-specific adapter
  does not fit;
- `@ai-sdk/react@3.0.86` only for React surfaces that need it.

Versions are exact. Review one converging upgrade monthly; do not let every
repository drift independently.

The gateway endpoint comes from runtime configuration and the gateway key from
a secret. Values never belong in source, examples, audit reports, or shared
configuration.

Swift, Rust, Python, and other runtimes where the Vercel AI SDK cannot run use
the smallest maintained native client. The audit records those as dated
exceptions or native paths; it does not force a JavaScript dependency into an
incompatible runtime.

## Routing rules

- Route model calls through the Free AI gateway with `model: "auto"` and the
  product's project id.
- A local model is acceptable where the product's requirement is local
  inference (for example `posttrainllm`).
- Do not add paid-provider spend or a new direct provider credential.
- A direct provider call in a product is migration debt toward the gateway.
- Hand-written JS/TS HTTP remains migration debt; the pinned SDK (with the
  OpenAI-compatible adapter pointed at the gateway) is the maintained seam.

## What the audit proves

`scripts/ai-client-audit.mjs` reads package manifests and tracked source across
the supplied project list. It reports exact SDK pins, ranged/off-pin packages,
provider SDK and raw HTTP paths, retired gateway references, and
credential-shaped literals. High-confidence provider calls stay separate from
mentions, examples, tests, and endpoint pickers.

The detector fails on a credential literal. It reports SDK drift and
hand-written calls as migration work so existing debt remains visible without
making shared tooling permanently red.

The detector's gateway host and `gatewayEnvNames` checks in
`config/ai-client-standard.json` predate the 2026-10-09 policy revision and
still flag gateway use as retired. Treat those findings as stale until the
audit is updated to the gateway-first policy.

## Exceptions

Exceptions live in `config/ai-client-standard.json` with a recorded date,
written reason, and review date when appropriate. They are for runtime or
product boundaries, not convenience.

The current exceptions are `free-ai`, which is the gateway and owns the
upstream provider clients, and `posttrainllm`, where local training/inference
and native evaluation paths are the product.

## Running the audit

```bash
pnpm tooling:ai-clients
node scripts/ai-client-audit.mjs
node scripts/ai-client-audit.mjs --json
node scripts/ai-client-audit.mjs --check
node scripts/ai-client-audit.mjs --omit-private
```

The default project list is Site Health's private catalog. Committed reports
use `--omit-private`, which counts private repositories without naming them.
Build output and dependency directories are excluded. Use `--explain` only
locally when a credential finding needs a file path.

Production deploys, credential changes, provider-resource deletion, and DNS
changes remain separate operational actions. Gateway authentication and the
project id contract are documented in the
[Free AI README](https://github.com/sass-maker/free-ai#authentication--project-id).
