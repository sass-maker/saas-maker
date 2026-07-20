# Studio local LLM providers

## Why

The studio currently upgrades from templates only via a paid DeepSeek key.
The operator wants LLM-quality output locally for most things using tools
already available at no marginal cost: the local Codex CLI (subscription,
already installed) and the fleet's free-ai gateway (OpenAI-compatible, free
providers).

## What Changes

- `src/studio/llm.js` becomes a provider chain: `free-ai` → `codex` →
  `deepseek` → template fallback, tried in order until one is configured and
  succeeds. Order overridable via `STUDIO_LLM_PROVIDERS`.
- New providers:
  - `free-ai`: OpenAI-compatible chat completions against the fleet gateway
    (`FREE_AI_API_KEY`, optional `FREE_AI_BASE_URL`, `FREE_AI_MODEL`
    defaulting to `auto`, project id header for analytics).
  - `codex`: local `codex exec` non-interactive call (read-only sandbox,
    ephemeral, JSON-only output); available when the CLI is on PATH.
- Result envelope gains `provider` (additive); `source: llm|template`
  unchanged so existing consumers/tests keep working.
- `.env.example` documents the new vars; docs updated.

## Capabilities

### Modified Capabilities

- `content-studio`: the zero-cost requirement now specifies the provider
  chain (free-ai, codex, deepseek) instead of DeepSeek-only.

## Impact

- `src/studio/llm.js`, `test/studio-tools.test.js` additions,
  `test/studio-llm-providers.test.js`, `.env.example`,
  `docs/content-studio.md`. No changes to tool modules — they already go
  through `StudioLlm.generate()`.
