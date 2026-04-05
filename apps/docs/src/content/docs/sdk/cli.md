---
title: CLI
description: API-first SaaS Maker CLI with OpenAPI-enforced route access.
---

The SaaS Maker CLI is intentionally API-first:

- Keep command surface small
- Use `saasmaker api` for all backend capabilities
- Avoid feature-specific CLI code for each new API route

## Installation

```bash
npm install -g @saas-maker/cli
```

## Quick Start

```bash
saasmaker login
saasmaker init
saasmaker doctor
```

## Core Commands

- `login` — browser OAuth auth
- `init` — link local directory to a project
- `whoami` / `keys` — inspect auth + linked context
- `projects list|create` — project management
- `ai-mention config|prompts|prompts-add|check|history` — AI mention monitoring
- `status` — feature status snapshot
- `doctor` — configuration/auth diagnostics
- `examples` — copy-paste API-first recipes
- `completions` — shell autocompletion scripts
- `api` — universal endpoint access

## Universal API Command

```bash
saasmaker api <method> <path> [options]
```

### Auth options

- `--auth session` → Bearer token
- `--auth project` → `X-Project-Key`
- `--auth auto` (default) → use available context
- `--auth none`

### Request options

- `--body '{...json...}'`
- `--body-file ./payload.json`
- `--query key=value` (repeatable)
- `--header key=value` (repeatable)
- `--token` / `--project-key` overrides

### Output options

- `--output json|table`
- `--select field1,field2`
- `--quiet`
- `--raw`

## OpenAPI Validation

`saasmaker api` validates method/path against OpenAPI by default.

- Skip validation only when needed: `--no-validate`
- Generated spec paths:
  - `packages/cli/src/openapi.json` (CLI enforcement source)
  - `docs/openapi/openapi.json` (repo artifact)
  - `apps/docs/public/openapi.json` (published docs artifact)
- Regenerate spec:

```bash
pnpm generate:openapi
```

## Recipes

```bash
# Health check
saasmaker api GET /health --auth none

# Session route
saasmaker api GET /v1/projects --auth session --output table

# Project-key route
saasmaker api GET /v1/feedback --auth project --query type=feature --output table

# Create feedback
saasmaker api POST /v1/feedback --auth project \
  --body '{"title":"Bug","description":"Broken CTA","submitter_email":"me@example.com","type":"bug"}'

# Create short link
saasmaker api POST /v1/links --auth project \
  --body '{"destination":"https://example.com","title":"Homepage"}'

# Dashboard forms
saasmaker api GET /v1/forms/dashboard/<projectId> --auth session --output table

# Save AI mention config (session route)
saasmaker api POST /v1/ai-mention/config/<projectId> --auth session \
  --body '{"brand_name":"Acme","platforms":["openai"],"openai_api_key":"sk-..."}'

# Run an AI mention check
saasmaker api POST /v1/ai-mention/check/<projectId> --auth session

# Dedicated helper command
saasmaker ai-mention history --project <projectId> --output table

# Approve testimonial
saasmaker api PATCH /v1/testimonials/<testimonialId> --auth session \
  --query project_id=<projectId> --body '{"status":"approved"}'
```
