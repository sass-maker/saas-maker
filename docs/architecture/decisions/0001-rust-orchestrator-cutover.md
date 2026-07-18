# ADR 0001: Rust orchestrator cutover

- **Status:** Accepted (Phases 1–4 done; Phase 6 partial)
- **Date:** 2026-07 (cutover completed; JS glue retired)
- **Context:** [`../rust-orchestrator.md`](../rust-orchestrator.md) ·
  historical plan: [`../../archive/2026-07-rust-rewrite-plan.md`](../../archive/2026-07-rust-rewrite-plan.md)

## Context

The Node implementation was the original orchestration glue: watcher,
autopilot, render-accepted, and post-ready scripts. It worked, but the logic
was spread across ad-hoc scripts with no trait boundaries, making the
"heavy lifting stays out of the orchestrator" rule hard to enforce and test.

## Decision

Add a single Rust crate (`reel/`) that owns the pure orchestration logic and
the engine/publisher/poster trait boundaries, with one shell-out impl each.
The Node implementation stays fully in place and untouched until parity is
reached; the Rust crate is additive. Heavy work (Chrome, ffmpeg, TTS, R2
upload, social APIs) stays behind traits — `RenderEngine`, `ArtifactPublisher`,
`MarketingPoster`, `SocialPoster`, `CommandRunner`, `ReelStore`,
`MarketingClient` — so orchestration is fully unit-tested without
Chrome/ffmpeg/network by asserting the exact `node`/`wrangler` argv that
*would* run.

## Consequences

- All entrypoints (`watch`, `render`, `render-accepted`, `autopilot`, `post`,
  `metrics`, `plan`, `validate-brief`, `score`, `config`) now live on the Rust
  CLI; JS watcher/autopilot/post glue retired with parity validated
  (`scripts/validate-watcher-parity.mjs`).
- `render-pro.js`, OAuth bootstrap scripts, and the `src/server` dev harness
  stay in Node — they are the shell-out targets or one-shot browser flows.
- The Cloudflare Worker (`src/worker/index.js`) stays in JS on purpose: it is
  the one piece that genuinely belongs on the edge runtime, and the Rust
  `artifact.rs` mirrors its key/content-type/range logic.
- Live actions default to `--dry-run`; `--execute` is required to render,
  upload, or post.

## Open follow-ups

- Drop `engines/openshorts` git submodule (explicit approval; see ADR 0002).
- Drop `engines/reel-maker` if `render-pro` fully supersedes Remotion
  (unchanged).
- `FileJobStore` timestamps are sortable placeholders (`@<secs>`), not RFC3339;
  switch to `time`/`chrono` if JS and Rust stores must interoperate on the same
  dir.
- `render-pro.js` writes the reel-record patch itself; the Rust watcher only
  needs exit code + the worker as source of truth. A future `--json` output
  mode on render-pro would let Rust collect richer result data.
