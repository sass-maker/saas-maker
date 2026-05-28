---
title: Foundry CLI (fnd)
description: Manage Foundry projects, tasks, and fleet operations from one CLI.
---

`fnd` (also installable as `foundry`) is the unified command-line interface for the Foundry platform. It is intentionally small: a few core utility commands plus a universal `fnd api <method> <path>` executor so new backend features do not require new CLI code.

## Install

```bash
npm install -g @saas-maker/cli
# or one-shot:
npx @saas-maker/cli --help
```

## First run

```bash
fnd login    # browser OAuth → stores session in ~/.foundry/config.json
fnd init     # link the current directory to a project (writes foundry.json)
fnd doctor   # verify auth, linked project, and standards compliance
```

## Command index

| Command | Purpose |
|---------|---------|
| `fnd login` | Browser OAuth login. Stores a session token in `~/.foundry/config.json`. |
| `fnd whoami` | Show the logged-in user and any linked project for this directory. |
| `fnd keys` | Print the session token and the linked project key. |
| `fnd init` | Link the current directory to a project (creates `foundry.json`). |
| `fnd doctor` (alias `fnd audit`) | Check Foundry compliance and configuration drift. |
| `fnd status` | Snapshot of feature counts and health for the linked project. |
| `fnd projects list\|create\|update\|delete` | Project management. |
| `fnd feedback`, `fnd roadmap`, `fnd changelog`, `fnd testimonials`, `fnd waitlist` | Per-service helpers. |
| `fnd forge` | Scaffold a new Foundry-compliant project. |
| `fnd fleet …` | Fleet-wide automation (see below). |
| `fnd examples` | Print copy-paste API recipes. |
| `fnd completions [bash\|zsh\|fish]` | Print a shell completion script. |
| `fnd api <method> <path>` | Universal API client — covers everything else. |

Run any command with `--help` for full flag documentation.

## Universal API command

```bash
fnd api <method> <path> [options]
```

`fnd api` is the recommended way to use Foundry from scripts and agents. It validates the request against the bundled OpenAPI spec before sending.

### Auth modes

- `--auth session` — sends `Authorization: Bearer <token>` from `fnd login`.
- `--auth project` — sends `X-Project-Key` from the linked `foundry.json`.
- `--auth auto` (default) — uses whichever auth context is available.
- `--auth none` — no auth (public endpoints).

### Common flags

| Flag | Effect |
|------|--------|
| `--body '<json>'` | Inline JSON body. |
| `--body-file ./payload.json` | Read body from disk. |
| `--query key=value` | Append a query param (repeatable). |
| `--header key=value` | Add a request header (repeatable). |
| `--output json\|table` | Pick output format. |
| `--select field1,field2` | Project specific fields (supports dotted paths). |
| `--raw` | Compact JSON, suitable for piping. |
| `--quiet` | Suppress request/status logs. |
| `--token <t>` / `--project-key <k>` | Override stored credentials. |
| `--no-validate` | Skip OpenAPI enforcement (for experimental routes). |

## Recipes

### Health check

```bash
fnd api GET /health --auth none
```

### Project metadata

```bash
# List projects you own
fnd api GET /v1/projects --auth session --output table

# Update the dashboard README / notes for a project
fnd api PATCH /v1/projects/<projectId> --auth session \
  --body '{"readme":"Internal launch notes and owner context."}'
```

### Tasks (Symphony)

```bash
# List your tasks, filter by project
fnd api GET /v1/tasks --auth session --query project_slug=my-app --output table

# Create a task
fnd api POST /v1/tasks --auth session \
  --body '{"title":"Ship invite flow","project_slug":"my-app","priority":"high"}'

# Move a task forward
fnd api PATCH /v1/tasks/<taskId> --auth session \
  --body '{"status":"in_progress"}'

# Add a comment
fnd api POST /v1/tasks/<taskId>/comments --auth session \
  --body '{"body":"PR opened — waiting on review.","author_type":"agent"}'
```

### Feedback (project key)

```bash
fnd api POST /v1/feedback --auth project \
  --body '{"title":"Bug","description":"Broken CTA","submitter_email":"me@example.com","type":"bug"}'

fnd api GET /v1/feedback --auth project --query type=feature --output table
```

### AI Gateway (BYOK)

```bash
# Configure provider for a project (key is masked on read)
fnd api PUT /v1/ai/config --auth session --query project_id=<projectId> \
  --body '{"ai_base_url":"https://api.openai.com/v1","ai_model":"gpt-4o-mini","ai_api_key":"sk-..."}'

# Proxy a chat completion through the linked project
fnd api POST /v1/ai/chat/completions --auth project \
  --body '{"messages":[{"role":"user","content":"Write release notes"}]}'

# Inspect usage and request logs
fnd api GET /v1/ai/usage --auth session --query project_id=<projectId> --output table
```

### Symphony memory, audit, and run ledger

```bash
fnd api GET /v1/symphony/memory --auth session
fnd api PUT /v1/symphony/memory --auth session \
  --body '{"content":"Prefer Gemini for bounded cheap asks. Keep CI fixes surgical."}'

fnd api GET /v1/symphony/audit --auth session --output table
fnd api GET /v1/symphony/runs --auth session --output table
```

### Marketing queue

Agents should add publishable marketing ideas directly to the queue, then the
owner accepts/rejects and marks accepted ideas as sent after posting.

```bash
fnd api POST /v1/marketing/posts --auth session \
  --body '{"project_slug":"linkchat","channel":"x","status":"generated","source_type":"task","source_id":"<taskId>","task_id":"<taskId>","title":"Short idea title","hook":"Plain hook","body":"Post body","cta":"Try it and send feedback."}'

fnd api GET /v1/marketing/posts --auth session --query status=generated --output table

fnd api PATCH /v1/marketing/posts/<postId> --auth session \
  --body '{"status":"accepted"}'
```

## Fleet automation

The `fnd fleet` commands operate across a fleet of repositories on disk (default: `~/Desktop/Fleet`). They are designed for the maintainer working many repos in parallel — most product users won't need them.

| Command | What it does |
|---------|--------------|
| `fnd fleet list` | List discovered projects with status and slugs. |
| `fnd fleet run "<cmd>"` | Run a shell command across every project. |
| `fnd fleet audit` | Standards + code health pass. |
| `fnd fleet fix` | Apply standards drift fixes automatically. |
| `fnd fleet versions [list\|fix]` | Surface and resolve dependency-version drift. |
| `fnd fleet secrets-sync` | Push shared env values to per-project `.env.local` files. |
| `fnd fleet clean [--deep]` | Reclaim disk space by purging build caches. |
| `fnd fleet provision` | Provision a project's cloud surfaces. |
| `fnd fleet apply <skill>` | Run an evolutionary refactor across every repo. |
| `fnd fleet supervise` | Watch the global error feed and dispatch fixes via agents. |

## Configuration

### `~/.foundry/config.json`

Created by `fnd login`:

```json
{
  "apiKey": "sm_...",
  "apiBaseUrl": "https://api.sassmaker.com"
}
```

### `foundry.json`

Created by `fnd init` in each linked project:

```json
{
  "slug": "my-app",
  "projectId": "uuid-project-id",
  "projectKey": "pk_..."
}
```

Older `foundry.json` files that store only `projectId` as a `pk_...` key are still accepted.

### Environment overrides

- `FND_API_URL` — point the CLI at a different API base URL (useful for staging or local development).

## OpenAPI enforcement

`fnd api` validates method and path against the bundled OpenAPI spec by default. After changing or adding routes in `workers/api`, regenerate the spec so the CLI accepts the new endpoints:

```bash
pnpm generate:openapi
```

This refreshes `packages/cli/src/openapi.json`, `apps/docs/public/openapi.json`, and `docs/openapi/openapi.json`. To send a request that isn't in the spec yet, pass `--no-validate`.
