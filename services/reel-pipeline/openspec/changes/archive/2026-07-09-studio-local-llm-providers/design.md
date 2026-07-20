# Design — studio local LLM providers

## Approach

Keep `StudioLlm`'s public surface (`isConfigured()`, `chatJson()`,
`generate()`) so no tool module changes. Internally, build an ordered provider
list at construction:

- Explicit `options.providers` array wins (tests inject stubs this way).
- Back-compat: an explicit `apiKey` option means "deepseek only" — existing
  tests and smokes construct `new StudioLlm({ apiKey: '' })` to force template
  mode and `{ apiKey: 'k', fetchImpl }` to stub the HTTP path; both must keep
  working unchanged.
- Otherwise: `STUDIO_LLM_PROVIDERS` env (comma list) or default
  `free-ai,codex,deepseek`, each instantiated from env.

## Providers

| Provider | Configured when | Call |
| --- | --- | --- |
| `free-ai` | `FREE_AI_API_KEY` set | POST `${FREE_AI_BASE_URL:-https://free-ai-gateway.sarthakagrawal927.workers.dev}/v1/chat/completions`, bearer key, `X-Gateway-Project-Id: ${FREE_AI_PROJECT_ID:-reel-pipeline}`, model `${FREE_AI_MODEL:-auto}`, `response_format: json_object`, 45s abort |
| `codex` | `codex` CLI on PATH (checked once, cached; overridable `STUDIO_CODEX_BIN`) | `codex exec --ephemeral --skip-git-repo-check --sandbox read-only --color never -o <tmpfile> -` with the prompt on stdin; optional `-m ${STUDIO_CODEX_MODEL}`; 120s timeout; parse tmpfile, strip code fences |
| `deepseek` | `DEEPSEEK_API_KEY` set | existing request shape |

`generate()` walks configured providers in order; each failure logs a warn and
tries the next; exhaustion → template fallback. Envelope becomes
`{ source, provider?, data }` — additive.

Codex runs are agent turns (seconds, not milliseconds); acceptable for an
operator tool. The codex provider sends one flattened prompt (system + user +
"reply with only the JSON object") since `exec` takes a single instruction.

## Testing

- `test/studio-llm-providers.test.js`: chain order, skip-unconfigured,
  failure fall-through, codex output parsing (fenced JSON), free-ai request
  shape — all with injected stubs (`fetchImpl`, `codexRunner`); no real CLI or
  network.
- Existing tests unchanged prove back-compat.
- Manual live proof: one tiny real `codex exec` JSON call; free-ai live call
  only if the operator's env has a key.

## Risks

- Codex CLI flag drift across versions — isolated in one provider class;
  failure just falls through the chain.
- free-ai `auto` model quality varies by upstream health — acceptable; JSON
  parse failures fall through like any provider error.
