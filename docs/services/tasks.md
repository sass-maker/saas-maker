---
title: "Tasks (Symphony)"
description: "Durable task records with comments, blockers, PR status, and deploy state — the source of truth for fleet work."
---

Foundry tasks are the system of record for work in flight across your project fleet. Every task has a title, status, priority, optional project link, dependencies, comment thread, and branch/PR/deploy fields so agents and humans can hand off without losing context.

Tasks are managed in the Cockpit UI ([app.sassmaker.com](https://app.sassmaker.com)), through the API, or via `fnd api` — the same endpoints power all three.

## Anatomy of a task

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Stable identifier. |
| `title` | string | Required. Short imperative summary. |
| `description` | string | Optional. Multi-line markdown. |
| `project_slug` | string | Optional. Pins the task to a project (filterable). |
| `status` | enum | `pending`, `in_progress`, `blocked`, `completed`. |
| `priority` | enum | `low`, `normal`, `high`. |
| `task_type` | enum | Free-form bucket — e.g. `bug`, `feature`, `chore`. |
| `size` | enum | `s`, `m`, `l`. |
| `dependencies` | string[] | Other task IDs that block this one. |
| `branch_name` | string | Git branch. |
| `pr_url`, `pr_status` | string, enum | PR link and one of `none`, `draft`, `open`, `merged`, `closed`. |
| `commit_sha` | string | Last known commit. |
| `deployment_url`, `deployment_status` | string, enum | Deploy URL and one of `none`, `pending`, `success`, `failed`. |
| `blocked_on_user` | boolean | When `true`, deployment status is forced back to `none`. |

`blocked_on_user` and `deployment_status` are mutually exclusive — setting one clears the other.

## Authentication

All task endpoints require a session token. Use `fnd login` to obtain one or pass `Authorization: Bearer <token>` directly.

## API endpoints

### List tasks

```
GET /v1/tasks
```

Optional filters: `status`, `project_slug`.

```bash
fnd api GET /v1/tasks --auth session --query status=in_progress --output table
```

**Response (200):**

```json
{ "data": [ { "id": "task_...", "title": "...", "status": "in_progress", ... } ] }
```

### Get one task

```
GET /v1/tasks/:id
```

```bash
fnd api GET /v1/tasks/<taskId> --auth session
```

Returns `404` if the task does not belong to the authenticated user.

### Create a task

```
POST /v1/tasks
```

```bash
fnd api POST /v1/tasks --auth session \
  --body '{
    "title": "Ship invite flow",
    "description": "Implement invitation tokens and email delivery.",
    "project_slug": "my-app",
    "priority": "high",
    "task_type": "feature",
    "size": "m",
    "dependencies": ["task_abc"]
  }'
```

| Field | Required | Notes |
|-------|----------|-------|
| `title` | Yes | Non-empty string. |
| `description` | No | |
| `project_slug` | No | Surface the task on the project's task board. |
| `priority` | No | Defaults to `normal`. |
| `task_type`, `size` | No | Free-form buckets. |
| `dependencies` | No | Array of other task IDs. |
| `branch_name`, `pr_url`, `pr_status`, `commit_sha` | No | Git state — usually set by agents as work progresses. |
| `deployment_url`, `deployment_status`, `blocked_on_user` | No | Deploy state. |

**Response (201):** Full task object.

### Update a task

```
PATCH /v1/tasks/:id
```

Any subset of the create fields, plus `status`. Setting `blocked_on_user: true` clears `deployment_status`; setting `deployment_status` to anything other than `none` clears `blocked_on_user`.

```bash
fnd api PATCH /v1/tasks/<taskId> --auth session \
  --body '{ "status": "in_progress", "branch_name": "feature/invites" }'
```

### Delete a task

```
DELETE /v1/tasks/:id
```

```bash
fnd api DELETE /v1/tasks/<taskId> --auth session
```

**Response (200):** `{ "ok": true }`

## Comments

Comments belong to a task and have an `author_type` of either `user` or `agent`.

### List comments

```
GET /v1/tasks/:id/comments
```

### Add a comment

```
POST /v1/tasks/:id/comments
```

```bash
fnd api POST /v1/tasks/<taskId>/comments --auth session \
  --body '{
    "body": "PR opened — waiting on review.",
    "author_type": "agent",
    "author_label": "claude-opus"
  }'
```

| Field | Required | Notes |
|-------|----------|-------|
| `body` | Yes | Markdown text. |
| `author_type` | No | `user` (default) or `agent`. |
| `author_label` | No | Optional display label for agent comments. |

## Symphony memory, audit, and runs

Tasks integrate with three Symphony surfaces that record how work was actually executed by agents:

- `/v1/symphony/memory` — operating notes shared with local agents.
- `/v1/symphony/audit` — append-only audit log of task dispatches and agent handoffs.
- `/v1/symphony/runs` — ledger of local task-run starts with agent profile, pid, command, and cost notes.

See the [CLI page](/sdk/cli) for recipes.
