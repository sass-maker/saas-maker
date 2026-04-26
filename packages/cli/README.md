# @saas-maker/cli

API-first CLI for Foundry.

The CLI is intentionally minimal: a few core utility commands plus a universal `saasmaker api` executor so new backend features do not require new CLI code.

## Install

```bash
npm install -g @saas-maker/cli
# or use directly:
npx @saas-maker/cli
```

## Quick Start

```bash
saasmaker login
saasmaker init
saasmaker doctor
```

## Core Commands

- `saasmaker login` — browser OAuth login
- `saasmaker init` — link current directory to a project
- `saasmaker whoami` — show token + linked project context
- `saasmaker keys` — show session token + linked project key
- `saasmaker projects list|create` — project management
- `saasmaker fleet list|run|search|audit|fix|provision|apply|supervise|clean|secrets-sync|upgrade|versions` — fleet automation
- `saasmaker forge` — scaffold a new Foundry-compliant project
- `saasmaker feedback|roadmap|changelog|testimonials|waitlist` — block management
- `saasmaker analytics dashboard|setup|forge-dashboard|detail` — analytics block
- `saasmaker status` — feature health/count snapshot
- `saasmaker audit` (alias `doctor`) — Foundry compliance check
- `saasmaker examples` — copy-paste command recipes
- `saasmaker completions [bash|zsh|fish]` — shell completion script
- `saasmaker api <method> <path>` — universal API access

## Universal API Command

```bash
saasmaker api <method> <path> [options]
```

### Auth Modes

- `--auth session` uses `Authorization: Bearer <token>` from `login`
- `--auth project` uses `X-Project-Key` from linked `.saasmaker.json`
- `--auth auto` (default) attaches whichever auth context is available
- `--auth none` sends no auth

### Output / Scripting

- `--output json|table`
- `--select field1,field2` (supports dotted paths)
- `--quiet` (suppresses request/status logs)
- `--raw` (compact JSON for scripts)

### Request Options

- `--body '{...json...}'`
- `--body-file ./payload.json`
- `--query key=value` (repeatable)
- `--header key=value` (repeatable)
- `--token <token>` / `--project-key <key>` override stored credentials

## OpenAPI Enforcement

`saasmaker api` validates method/path against OpenAPI by default.

- Bypass for experimental routes: `--no-validate`
- Spec source used by CLI: `packages/cli/src/openapi.json`
- Published docs artifact: `apps/docs/public/openapi.json`
- Regenerate from route files:

```bash
pnpm generate:openapi
```

This also updates `docs/openapi/openapi.json`.

## API-First Recipes

```bash
# Health
saasmaker api GET /health --auth none

# Session-auth route: projects
saasmaker api GET /v1/projects --auth session --output table

# Project-auth route: list feedback
saasmaker api GET /v1/feedback --auth project --query type=feature --output table

# Create feedback
saasmaker api POST /v1/feedback --auth project \
  --body '{"title":"Bug","description":"Broken CTA","submitter_email":"me@example.com","type":"bug"}'

# Public roadmap items by project slug
saasmaker api GET /v1/roadmap/by-project/<slug> --auth project --output table

# Vote on a roadmap item (public, rate-limited)
saasmaker api POST /v1/roadmap/public/<slug>/<itemId>/vote --auth none \
  --body '{"user_identifier":"voter@example.com"}'

# Approve testimonial (session route)
saasmaker api PATCH /v1/testimonials/<testimonialId> --auth session \
  --query project_id=<projectId> --body '{"status":"approved"}'
```

## Configuration

### Global config: `~/.saasmaker/config.json`

```json
{
  "apiKey": "sm_...",
  "apiBaseUrl": "https://api.saasmaker.dev"
}
```

### Project config: `.saasmaker.json`

```json
{
  "slug": "my-app",
  "projectId": "uuid-project-id",
  "projectKey": "pk_..."
}
```

Backward compatibility: older `.saasmaker.json` files that stored only `projectId` as a `pk_...` key are still supported.

### Environment variable

- `SAASMAKER_API_URL` — override API base URL
