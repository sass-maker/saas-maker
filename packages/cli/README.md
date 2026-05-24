# @saas-maker/cli

API-first CLI for Foundry.

The CLI is intentionally minimal: a few core utility commands plus a universal `fnd api` executor so new backend features do not require new CLI code.

## Install

```bash
npm install -g @saas-maker/cli
# or use directly:
npx @saas-maker/cli
```

## Quick Start

```bash
fnd login
fnd init
fnd doctor
```

## Core Commands

- `fnd login` — browser OAuth login
- `fnd init` — link current directory to a project
- `fnd whoami` — show token + linked project context
- `fnd keys` — show session token + linked project key
- `fnd projects list|create` — project management
- `fnd fleet list|run|search|audit|fix|provision|apply|supervise|clean|secrets-sync|upgrade|versions` — fleet automation
- `fnd forge` — scaffold a new Foundry-compliant project
- `fnd feedback|roadmap|changelog|testimonials|waitlist` — block management
- `fnd status` — feature health/count snapshot
- `fnd audit` (alias `doctor`) — Foundry compliance check
- `fnd examples` — copy-paste command recipes
- `fnd completions [bash|zsh|fish]` — shell completion script
- `fnd api <method> <path>` — universal API access

## Universal API Command

```bash
fnd api <method> <path> [options]
```

### Auth Modes

- `--auth session` uses `Authorization: Bearer <token>` from `login`
- `--auth project` uses `X-Project-Key` from linked `foundry.json`
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

`fnd api` validates method/path against OpenAPI by default.

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
fnd api GET /health --auth none

# Session-auth route: projects
fnd api GET /v1/projects --auth session --output table

# Add dashboard notes
fnd api PATCH /v1/projects/<projectId> --auth session \
  --body '{"readme":"Internal launch notes and owner context."}'

# Read and update Symphony operating memory
fnd api GET /v1/symphony/memory --auth session
fnd api PUT /v1/symphony/memory --auth session \
  --body '{"content":"Prefer Gemini for bounded cheap asks. Keep CI fixes surgical."}'

# Inspect Symphony task and agent activity
fnd api GET /v1/symphony/audit --auth session --output table
fnd api POST /v1/symphony/audit --auth session \
  --body '{"action":"task_dispatched","actor_source":"local-cli","agent_profile":"gemini"}'

# Inspect Symphony run ledger entries
fnd api GET /v1/symphony/runs --auth session --output table
fnd api POST /v1/symphony/runs --auth session \
  --body '{"task_id":"<taskId>","command_template":"gemini","agent_profile":"gemini","cost_note":"cheap-default route"}'

# Project-auth route: list feedback
fnd api GET /v1/feedback --auth project --query type=feature --output table

# Create feedback
fnd api POST /v1/feedback --auth project \
  --body '{"title":"Bug","description":"Broken CTA","submitter_email":"me@example.com","type":"bug"}'

# Configure BYOK AI provider (provider key is masked in reads)
fnd api PUT /v1/ai/config --auth session --query project_id=<projectId> \
  --body '{"ai_base_url":"https://api.openai.com/v1","ai_model":"gpt-4o-mini","ai_api_key":"sk-..."}'

# Proxy a chat completion through the linked project
fnd api POST /v1/ai/chat/completions --auth project \
  --body '{"messages":[{"role":"user","content":"Write release notes"}]}'

# Inspect AI usage and request logs
fnd api GET /v1/ai/usage --auth session --query project_id=<projectId> --output table
fnd api GET /v1/ai/requests --auth session --query project_id=<projectId> --output table

# Public roadmap items by project slug
fnd api GET /v1/roadmap/by-project/<slug> --auth project --output table

# Vote on a roadmap item
fnd api POST /v1/roadmap/public/<slug>/<itemId>/vote --auth none \
  --body '{"user_identifier":"voter@example.com"}'

# Approve testimonial (session route)
fnd api PATCH /v1/testimonials/<testimonialId> --auth session \
  --query project_id=<projectId> --body '{"status":"approved"}'
```

## Configuration

### Global config: `~/.foundry/config.json`

```json
{
  "apiKey": "sm_...",
  "apiBaseUrl": "https://api.sassmaker.com"
}
```

### Project config: `foundry.json`

```json
{
  "slug": "my-app",
  "projectId": "uuid-project-id",
  "projectKey": "pk_..."
}
```

Backward compatibility: older `foundry.json` files that stored only `projectId` as a `pk_...` key are still supported.

### Environment variable

- `FND_API_URL` — override API base URL
