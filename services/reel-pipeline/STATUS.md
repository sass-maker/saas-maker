# STATUS

Short executive view. Detailed status, dependencies, timeline, and feature
inventory live in [`PROJECT_STATUS.md`](PROJECT_STATUS.md). Architecture and
decisions live under [`docs/`](docs/index.md).

## Objective

Turn approved SaaS Maker marketing ideas, High Signal briefs, Significant
Hobbies envelopes, and public brand URLs into reviewable short-form video
drafts, rendered MP4s, and gated posting handoff — without becoming the source
of product claims or marketing approval state.

## What works

- **Anonymous brand reel** (public visitor surface): HTTPS brand URL →
  DNS-pinned bounded intake → evidence-backed brief → presenter-led 9:16 reel
  → safe status/preview/download. No auth, billing, workspaces, actor
  onboarding, payouts, or social posting. Checksum-pinned fictional synthetic
  presenter with provenance attestation.
- **Marketing autopilot** (internal): SaaS Maker queue → hold-window
  auto-accept → render accepted posts → R2 artifact → gated post to YouTube /
  Instagram. Multi-account routing via `config/social-accounts.json`.
  Missed-post recovery and metrics backfill in Rust.
- **Worker reel flow** (production render path): Cloudflare Worker + R2 →
  Rust watcher → `node scripts/render-pro.js` (Chrome CDP + Edge TTS + ffmpeg
  + R2 upload + worker patch).
- **Render modes**: `mock`, `html-composition`, `ascii`, `grok-video`,
  `reel-maker`, `moneyprinterturbo`, `render-pro`, `kokoro`, `brand-video`.
  Local/no-credential modes proven by `npm run smoke:render-modes`.
- **Content studio + faceless workflow + lesson pipeline + factory conveyor**
  with quality gate and publish packets.
- **Significant Hobbies handoff**: versioned intake + idempotent Idea Store +
  render/upload/metrics receipts + draft-only follow-up briefs.
- **Source-backed marketing packages** for seven fleet brands (AliveVille,
  High Signal, Karte, RolePatch, SaaS Maker, Significant Hobbies, SWE
  Interview Prep).
- **Rust orchestrator cutover**: all entrypoints on Rust CLI; JS
  watcher/autopilot/post glue retired with parity validated.

## Active work

- Documentation consolidation (this change): reorganized `docs/` into
  product/architecture/decisions/development/operations/knowledge, added
  Blume config, ADRs, validation, and CI.

## Blockers

- **Target-host readiness not complete.** `tmp/generation-readiness/report.json`
  must reach `targetHostReady: true`. Open case checks:
  - `marketing-render-modes`: `social-posting-prereqs` (YouTube or Instagram
    OAuth env).
  - `worker-render-pro`: `render-pro-live-proof` (real approved Worker reel id
    + R2 playback proof).
  - `lesson-video`: `lesson-live-prereqs` (DeepSeek, ElevenLabs, Pexels env).
  - `creator-mvp`: `creator-mvp-reviewed` (three manual story videos
    reviewed).
- **Anonymous presenter canary:** a production-environment canary with the
  checksum-pinned synthetic presenter remains an operator release gate. No
  local implementation blocker.

## Next steps

1. Close target-host readiness open checks (see
   [`docs/operations/runbooks/generation-readiness.md`](docs/operations/runbooks/generation-readiness.md)).
2. Produce the first three manual creator-MVP kids-story videos from
   [`docs/product/creator-mvp-packs/`](docs/product/creator-mvp-packs/) and
   record watch/parent-trust notes.
3. Run one 35-post app-marketing experiment across the five growth formats
   ([`docs/product/growth-format-playbook.md`](docs/product/growth-format-playbook.md)).
4. Get explicit approval to remove the parked `engines/openshorts` submodule.
5. Product-proof Phase 2 (screen-recording renderer) and Phase 3
   (multi-variant drafts) after Phase 1 stabilizes.

## Practical caveat

The pipeline is technically working. The generated videos are still
low-quality until creative direction, footage selection, UGC actor support,
and post-render review improve. Treat the current release as infrastructure
and draft production, not final marketing quality.
