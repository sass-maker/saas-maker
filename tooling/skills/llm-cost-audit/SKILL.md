---
name: llm-cost-audit
description: >
  Audit and fix the code patterns that make AI/LLM API bills blow up: retries
  that loop or stack, no spending limit, no cap on output length, agent/tool
  loops that never stop, rate-limit pileups (429s), and re-sending the same
  big prompt without caching. Provider-agnostic — OpenAI, Anthropic,
  Gemini/Vertex, OpenRouter, LiteLLM, Vercel AI SDK, Cloudflare Workers AI.
  Use whenever the user raises AI cost or a surprise bill: "bill spiked",
  "runaway spend", "retry storm", "getting 429s", "add a spend cap or token
  budget", "audit our AI integration". Not for general cloud cost (use
  cloudflare-spend-guard) or answer quality.
---

# llm-cost-audit

LLM spend is dangerous differently: a single defect runs *unbounded*
overnight — a retry loop on 429 hammers the provider thousands of times, an
agent with no iteration cap calls tools forever, no output cap means a
repetition loop bills to the context limit. None throw in review; they just
cost money.

The bar: **"would this surprise me on the invoice?"** — not theoretical
optimality. Never break working features; prefer additions (a limit, a
spending check) over changes that degrade output. Every finding ends with the
exact fix (real parameter names — `max_tokens` vs `maxOutputTokens` vs
`maxTokens` — not simplified).

## Method

1. **Find every call site.** Grep for SDK signatures: `openai`, `OpenAI(`,
   `chat.completions.create`, `anthropic`, `messages.create`, `@google/genai`,
   `generateContent`, `ai`/`generateText`/`streamText` (Vercel), `litellm`,
   `openrouter`, `env.AI.run` (Workers AI), plus project wrappers
   (`ai_client`, `llm.`, `chat(`, `complete(`) and env keys
   (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, …). Manifests reveal the SDKs.
2. **Per-call-site pass** — walk each call against the checklist.
3. **System-level pass** — the most expensive guardrails are *absences*: is
   there ANY global spend ceiling, per-user cap, concurrency limit, usage
   logging anywhere? No single call site reveals a missing ceiling.
4. **Confirm before flagging** — check for a wrapper/middleware that already
   caps it; check SDK defaults (most retry ~2× — a custom wrapper on top is
   the multiplicative bug). A traced call path, not speculation.

## Checklist — critical (unbounded spend)

- **No spend ceiling anywhere** — no `budget|quota|spend|credits` gate before
  calls → the top finding. Fix: per-user *and* global check that refuses or
  queues at the cap, plus an alert.
- **Retrying errors that can't succeed** — retrying 400/401/404 costs money
  and always fails. Retry only 429/5xx/timeouts.
- **Retry storms** — fixed-delay or no-delay loops; unbounded `for`/`while`
  retries. Fix: bounded attempts, exponential backoff with jitter.
- **Stacked retries** — SDK default retries × custom wrapper × job-queue
  retry = multiplicative. Count the product of all layers.
- **Agent/tool loops without a stop** — while-loop over tool calls with no
  `maxIterations`, no token wall-clock budget, no termination condition.
- **No output cap** — missing `max_tokens`/`maxOutputTokens`; a repetition
  loop bills to the context limit.
- **User-triggerable unbounded fan-out** — an endpoint where one request
  spawns N model calls with N user-controlled.

## Checklist — serious (waste, not ruin)

- Same prompt re-sent with no cache — identical input → identical answer;
  cache it or use provider prompt-caching for big stable prefixes.
- Large context sent when a retrieval/trimmed slice suffices.
- A frontier model doing a small-model job (classification, extraction).
- Streaming billed output with no abort handling — user disconnects, tokens
  keep generating.
- Per-request client init or unbatched embeddings.
- No usage logging — you can't cap what you can't see; log
  `usage.prompt_tokens`/`completion_tokens` per call.

## Report

One short report, worst-first. Plain words for the *why* (the reader may
never have tuned an AI integration), full precision for the *what to change*
(real params, real code). No invented dollar figures — say "nothing stops
this from running all night", not "$7,500". For the Fleet, also check
`saas-maker/tooling/config/ai-client-standard.json` conformance and note that
provider-level spend alerting lives in `cloudflare-spend-guard`, not here.
