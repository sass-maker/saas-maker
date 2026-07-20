# ADR 0004: Postiz and Editframe are pattern sources, not dependencies

- **Status:** Accepted
- **Date:** 2026-07-03 (Postiz patterns) / 2026-07-03 (Editframe HTML composition)
- **Context:** [`../../knowledge/learnings/oss-integration-evaluation.md`](../../knowledge/learnings/oss-integration-evaluation.md)

## Context

Postiz (`https://github.com/gitroomhq/postiz-app`, AGPL-3.0) is a strong
social-publishing workflow reference: provider capabilities, post preflight,
token/error classification, missed-post recovery, analytics, calendar/list UX.
But as a dependency it is a large NestJS/Prisma/Temporal monorepo with an AGPL
license that overlaps SaaS Maker's control-plane ownership.

Editframe (`https://editframe.com/`) is a strong agent/video-as-code reference:
HTML/CSS composition, an explicit time model, caption cues, local preview, and
visual testing. As a runtime dependency it would add another hosted video
runtime before the preview contract proved useful.

## Decision

Reimplement selected workflow patterns locally in the existing Node/Rust
contracts. Do not copy AGPL source and do not adopt either runtime.

From Postiz, reimplemented locally:

- provider capability declarations for manual, Upload-Post, YouTube, and
  Instagram;
- provider-specific preflight before posting;
- classified posting failures (`needs_reconnect`, `quota`, `rate_limited`,
  `provider_down`, `bad_caption`, `bad_asset`);
- per-post failure isolation so one broken post no longer aborts the scan;
- explicit missed-post recovery for overdue scheduled posts;
- provider-level analytics hooks for YouTube video statistics and Instagram
  media insights;
- a metrics backfill command patching the latest post-level metrics into
  SaaS Maker notes;
- a SaaS Maker Cockpit posting-ops summary;
- structured posting failure notes patched back to SaaS Maker while preserving
  SaaS Maker as the source of truth.

From Editframe, reimplemented locally as the `html`/`html-composition`/
`web-composition` render modes exporting `composition.html`, `timeline.json`,
and cue-level + word-level `captions.json` — a deterministic intermediate
representation agents can inspect and revise before any expensive render.

## Consequences

- No AGPL code enters this repo; the social-publishing and video-preview
  capabilities are owned code behind the existing provider/adapter contracts.
- SaaS Maker keeps the calendar/list UX and control-plane ownership; this repo
  keeps the wire-protocol clients and preflight.
- An inert Postiz contract fixture (`src/postiz-fixture-adapter.js`,
  `test/fixtures/postiz-contract.json`) proves translation, account isolation,
  channel-specific settings, publication results, and metrics normalization
  without importing Postiz code, making network calls, or connecting an
  account. Fixture success is not live Postiz readiness.
- HTML composition previews are review artifacts, not posting-ready MP4s; MP4
  capture from the HTML preview is deferred until one product flow proves the
  preview is useful enough to become a render source.
