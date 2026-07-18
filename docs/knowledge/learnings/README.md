# Learnings

Novel Cloudflare primitives, patterns, and project-specific gotchas powering
The Foundry. Each entry leans on external authoritative sources where they
exist and records the project-specific gotcha.

## Files

- [`new-things.md`](new-things.md) — CF Containers, DO + `@cloudflare/sandbox`,
  DeepSeek as the Droid LLM, AGENTS.md injection as prompting, DO embedded
  SQLite, better-auth bridge, Hono on Workers, R2, D1, Symphony model,
  DroidRunRoom, Browser Rendering API.

## Guidance

Per the global documentation standard: for concepts with authoritative
sources, reduce each entry to one-sentence "what", one-sentence "why it
matters to THIS project", a link to the source, and an optional "where in this
codebase" pointer. Do not re-explain things that already have a definitive
source.
