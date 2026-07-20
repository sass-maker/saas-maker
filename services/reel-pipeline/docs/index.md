# Reel Pipeline Docs

Local-first, agent- and human-readable knowledge system for `reel-pipeline`.
The committed Markdown in this `docs/` tree (plus the root `README.md`,
`AGENTS.md`, `STATUS.md`, and `PROJECT_STATUS.md`) is the source of truth.
Blume only renders it — see [`development/docs-build.md`](./development/docs-build.md).

Start at [`AGENTS.md`](../AGENTS.md) for the agent bootloader and
[`STATUS.md`](../STATUS.md) for the current executive view. The detailed
status and timeline live in [`PROJECT_STATUS.md`](../PROJECT_STATUS.md).

## Navigation

### Product — what the product is and how each surface works

- [`product/overview.md`](./product/overview.md) — surfaces, users, scope,
  source-of-truth boundaries.
- [`product/anonymous-brand-reel.md`](./product/anonymous-brand-reel.md) — the
  public visitor surface (brand URL → presenter-led reel).
- [`product/marketing-autopilot.md`](./product/marketing-autopilot.md) —
  SaaS Maker queue → render → post.
- [`product/creator-mvp.md`](./product/creator-mvp.md) — manual kids-story
  validation path.
- [`product/creator-mvp-packs/`](./product/creator-mvp-packs/) — three
  production-ready manual story packets.
- [`product/growth-format-playbook.md`](./product/growth-format-playbook.md) —
  app marketing format experiment loop.
- [`product/content-studio.md`](./product/content-studio.md) — TubeMagic-style
  creator toolset.
- [`product/faceless-workflow.md`](./product/faceless-workflow.md) —
  Vid.ai-style topic → video pipeline.
- [`product/lesson-video-pipeline.md`](./product/lesson-video-pipeline.md) —
  animated tutoring shorts.

### Architecture — how the system is built

- [`architecture/overview.md`](./architecture/overview.md) — control plane,
  two flows, core modules, safety properties.
- [`architecture/how-it-works.md`](./architecture/how-it-works.md) —
  learning-tier walkthrough: what actually runs when one reel is produced,
  stage by stage, and why it's built that way.
- [`architecture/engines.md`](./architecture/engines.md) — every render
  engine, pinned submodules, credits/inspiration.
- [`architecture/render-modes.md`](./architecture/render-modes.md) —
  VideoBrief contract + render mode matrix + readiness matrix.
- [`architecture/rust-orchestrator.md`](./architecture/rust-orchestrator.md) —
  Rust crate layout, trait boundaries, CLI surface.
- [`architecture/decisions/`](./architecture/decisions/) — architecture
  decision records (ADRs).

### Development — how to build, run, and verify

- [`development/setup.md`](./development/setup.md) — fresh clone, deps, env,
  first run.
- [`development/commands.md`](./development/commands.md) — canonical command
  reference.
- [`development/testing.md`](./development/testing.md) — tests, smokes,
  readiness gates, live proofs, completion rule.
- [`development/submodules.md`](./development/submodules.md) — submodule
  clone/update policy.
- [`development/docs-build.md`](./development/docs-build.md) — Blume setup and
  docs commands.

### Operations — how to run and operate it

- [`operations/deployment.md`](./operations/deployment.md) — per-host setup,
  systemd/launchd units, migration playbook.
- [`operations/auto-posting.md`](./operations/auto-posting.md) — autopilot
  loop, hold window, missed-post recovery, metrics backfill, multi-account.
- [`operations/instagram-setup.md`](./operations/instagram-setup.md) —
  Instagram Standard Access setup paths.
- [`operations/jobs/`](./operations/jobs/) — scheduled jobs (marketing control
  service, IG token refresh, metrics sync).
- [`operations/runbooks/`](./operations/runbooks/) — generation readiness,
  target-host readiness, Significant Content OpenClaw handoff, content
  package pipeline.

### Knowledge — durable learnings, evaluations, failed approaches

- [`knowledge/learnings/new-things.md`](./knowledge/learnings/new-things.md) —
  novel tech notes (Workers/Python interop, Gemini, fal.ai, ElevenLabs,
  Remotion, MoviePy, FFmpeg, OpenShorts, R2).
- [`knowledge/learnings/oss-integration-evaluation.md`](./knowledge/learnings/oss-integration-evaluation.md) —
  OSS integration shortlist and decisions.
- [`knowledge/failed-approaches/openshorts-adapter.md`](./knowledge/failed-approaches/openshorts-adapter.md) —
  why OpenShorts was removed as a default renderer.
- [`knowledge/project-recommendation-context.md`](./knowledge/project-recommendation-context.md) —
  Starboard recommendation context audit.

### Feature suggestions

- [`feature-suggestions/`](./feature-suggestions/) — proposed, not-yet-built
  feature ideas (posting handoff hardening, product proof capture v2, review
  queue automation).

### Archive

- [`archive/`](./archive/) — historical PRDs and plans, kept for git rename
  history. Living implementation lives in code, not here.

## Documentation maintenance rules

1. Markdown committed to this repo is the source of truth. Blume is only the
   presentation and search layer.
2. Code and executable configuration (`package.json`, `config/*.json`,
   `wrangler.jsonc`, CI workflows) remain authoritative for implementation
   details and schedules — do not duplicate those facts in prose; link to the
   file.
3. One canonical home per fact. Do not leave two homes for the same thing.
4. Document *why* systems work as they do, non-obvious constraints,
   operational procedures, important decisions, and reusable failed
   approaches. Do not re-explain things easily discoverable from code.
5. Do not invent information. Mark unresolved questions explicitly.
6. Do not create empty folders or placeholder documents.
7. Keep `AGENTS.md` concise and link to deeper docs here.
8. Preserve useful existing documentation and git history — use `git mv` when
   reorganizing so history follows.
9. When consolidating, prefer `archive/<name>.md` over deletion.
10. Run `npm run docs:validate` before committing doc changes; CI enforces it.

## ADR conventions

New architecture decisions go in `architecture/decisions/NNNN-<slug>.md` with
Status, Date, Context, Decision, Consequences, and Open follow-ups. Number
sequentially. Link the decision from the relevant overview/engines page.
