# Dynamic Workers for Foundry Symphony

**Date:** May 2, 2026
**Status:** Backlog plan
**Goal:** Evaluate Cloudflare Dynamic Workers as a cloud execution lane for Foundry Symphony tasks and fleet automations.

## Context

Cloudflare Dynamic Workers can load Worker code at runtime in an isolated sandbox. The useful theme for SaaS Maker is not replacing stable API routes. It is running generated or tenant-specific TypeScript with a narrow set of capabilities: task reads/writes, job logs, project metadata, standards, and optionally controlled outbound HTTP.

SaaS Maker already has the right anchor points:

- `/v1/tasks` is the production source of truth for Symphony work.
- `/v1/jobs` exists as the runtime/log surface.
- `/v1/standards/:type` exposes fleet configuration.
- The cockpit task board already has dispatch behavior, but remote mode currently only copies a prompt.
- The local Symphony runner shells out to local agents with broad machine permissions.

## Product Thesis

Dynamic Workers can become the safer, cloud-hosted option between "copy a prompt" and "run a local agent with full permissions."

The first version should run small task automations, not edit repositories directly. Repository edits need a later virtual workspace or GitHub-backed file API.

## Candidate Use Cases

### 1. Cloud Symphony Runner

Add a `Cloud Worker` dispatch target for cockpit tasks. The API creates a job, loads a Dynamic Worker, passes a narrow runtime API, runs one generated TypeScript function, and writes the result back to the job/task.

Example capabilities:

```ts
interface FoundryTaskRuntime {
  getTask(id: string): Promise<Task>;
  updateTask(id: string, patch: Partial<Task>): Promise<void>;
  listProjectMetadata(): Promise<ProjectMetadata[]>;
  getStandards(type: "next" | "vite" | "node"): Promise<Standards>;
  writeJobLog(jobId: string, line: string): Promise<void>;
}
```

### 2. Fleet Drift Analysis

Use Dynamic Workers to run analysis and produce repair plans from project metadata, standards, and drift reports. Keep actual file edits local until a safe workspace API exists.

### 3. Tenant Automations

Allow project-level automations such as:

- Convert high-signal feedback into tasks.
- Summarize open work weekly.
- Draft changelog text from completed tasks.
- Flag projects whose metadata or standards are stale.

### 4. OpenAPI Code Mode

Expose a compact typed wrapper around the Foundry API so an agent can write short TypeScript programs against the platform instead of making many sequential API calls.

## Non-Goals

- Do not move normal Hono CRUD routes into Dynamic Workers.
- Do not allow generated code direct D1, R2, AI, secret, or session access.
- Do not allow arbitrary internet access in the first iteration.
- Do not run repository file edits in cloud until there is a constrained workspace model.
- Do not add tenant-authored production code execution before the internal runner is proven.

## Architecture Sketch

### Bindings

Add a Worker Loader binding to the API Worker:

```toml
[[worker_loaders]]
binding = "LOADER"
```

Extend `Bindings` with `LOADER` once implementation starts.

### New API Surface

Initial routes:

- `POST /v1/jobs/dynamic-runs` — create and start a dynamic run for a task.
- `GET /v1/jobs/:id` — fetch job status and result.
- `GET /v1/jobs/:id/logs` — stream or poll logs.

The cockpit can use this from the task board as a `Cloud Worker` dispatch option.

### Runtime Contract

The loader Worker should expose only typed RPC methods needed by the run. Generated code receives `env.FOUNDRY`, not raw platform bindings.

Default sandbox policy:

- `globalOutbound: null`
- per-run timeout/custom limits
- structured input/output schema
- logs copied into `foundry_jobs`
- task status updated only through host-side validation

## Phased Plan

### Phase 0: Research Spike

- Confirm current Dynamic Workers API shape and Workers Paid requirements.
- Check pricing and beta limitations before implementation.
- Prototype `env.LOADER.load()` in a separate branch or minimal route.
- Verify local dev behavior with Wrangler.

### Phase 1: Internal Cloud Runner MVP

- Add `LOADER` binding to the API Worker.
- Create a small dynamic-run service under `workers/api/src`.
- Add a route that runs a fixed, checked-in TypeScript snippet against a mock/narrow Foundry runtime.
- Persist job status, logs, result, and error details.
- Add unit tests for route auth, validation, job status transitions, and blocked outbound access.

### Phase 2: Cockpit Dispatch

- Add `Cloud Worker` as a task dispatch option.
- Show run status and logs in the existing agent terminal/job UI.
- Keep the local dispatch path unchanged.

### Phase 3: Generated Code Mode

- Generate TypeScript only from an internal prompt/template.
- Validate code shape before execution.
- Pass only the minimal runtime capabilities required by the task.
- Store the generated source with the job for auditability.

### Phase 4: Fleet Automations

- Add built-in automation recipes for feedback-to-task, task summaries, standards checks, and stale metadata warnings.
- Keep file edits and git operations out of scope until a safe workspace API exists.

### Phase 5: Workspace-Backed Execution

- Evaluate `@cloudflare/shell`, R2-backed workspaces, GitHub file APIs, or a custom virtual filesystem.
- Add read-only repository snapshots first.
- Add transactional edit plans only after review, diff, and rollback paths are designed.

## Risks

- Dynamic Workers require Workers Paid and may have beta limitations.
- Generated code execution increases security review burden.
- Poorly scoped runtime APIs could accidentally expose secrets or broad data access.
- Job logging and observability need to be good enough to debug failed runs.
- Cloud execution cannot replace local agents for repo edits until workspace isolation exists.

## Success Criteria

- A cockpit task can be dispatched to a cloud sandbox.
- The sandbox can read task/project/standards data through narrow RPC.
- The run can write logs and a structured result to `foundry_jobs`.
- Outbound network is blocked by default.
- No raw credentials, D1 handles, R2 buckets, or user session tokens are visible to generated code.
- The local Symphony path remains unchanged.

## Open Questions

- Should dynamic run source be generated by Workers AI, the existing free-ai gateway, or a user-selected provider?
- Should generated code be stored forever for audit, or retained only with job logs?
- Should cloud runs update task status automatically, or only propose updates?
- Should this live in the main API Worker or a separate `workers/runner` service?
- What is the minimum useful runtime API for the first real task automation?
