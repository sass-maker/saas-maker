# Product Overview

Reel Pipeline is AI reel generation and autopost orchestration for the fleet.
It turns approved marketing ideas and public brand URLs into reviewable
short-form video drafts, rendered MP4s, and gated posting handoff.

## Surfaces

| Surface | Audience | Entry point |
| --- | --- | --- |
| Anonymous brand reel | Visitors | `npm run dev` → root page → submit one HTTPS brand URL |
| Marketing autopilot | Marketing operators | `npm run autopilot` / `reel autopilot` |
| Review UI | Reviewers | `npm run dev` → `/review` |
| Content studio | Creators | `npm run studio` / `npm run dev` → `/studio` |
| Faceless workflow | Creators | `npm run faceless` |
| Lesson pipeline | Tutors | `npm run lesson:render` |
| Artifact Worker | Browsers / integrators | `https://reel-pipeline-artifacts.sarthakagrawal927.workers.dev` |

The anonymous brand reel is the only visitor product surface. The rest are
internal tooling and do not add identity to the anonymous brand-reel path.

## Users

- **Visitors** generating an anonymous brand reel from a public website.
- **Marketing operators** running autopilot/post flows against the SaaS Maker
  queue.
- **Fleet integrators** syncing SaaS Maker marketing queue and Significant
  Hobbies content.
- **Reviewers** using the swipe approve/reject UI.

## Scope

**In scope:** anonymous HTTPS brand intake and presenter-led
preview/download; `VideoBrief` contract; MoneyPrinterTurbo + reel-maker
adapters; R2 artifact Worker; Rust CLI orchestration; YouTube + Instagram
Graph posting for internal accepted marketing items; source-backed packages
for seven fleet brands; product-proof Phase 1 quality gates; lightweight
draft/export support for the creator MVP.

**Out of scope:** OpenShorts adapter (removed); Cloudflare Worker rewrite of
orchestration; product-proof Phases 2–3 until Phase 1 stabilizes; kids-story
automation before the first three manual videos prove the format; auth,
billing, credits, actor onboarding/twins, KYC, earnings, payouts,
marketplace, and customer social posting for the anonymous surface.

## Source-of-truth boundaries

- **SaaS Maker** — system of record for the marketing queue; pull accepted
  reel items; patch `asset_url`, `result_url`, provider metadata, posting
  state.
- **High Signal** — reel brief intake via `src/signal-intake.js`.
- **Significant Hobbies** — approved, versioned reel envelopes imported into
  Idea Store with immutable source payloads; Reel returns file-based
  render/upload/metrics receipts and never edits the content checkout.
- **Reel Pipeline** — owns media production and posting adapters only; it does
  not become the source of product claims.

## Product constraints

- **Creator validation (kids stories):** the next step is a manual creator
  MVP, not more pipeline software. Make the first three public-domain story
  videos by hand before adding automation. See
  [`creator-mvp.md`](./creator-mvp.md).
- **Growth format (app marketing):** find a repeatable format that gets views
  consistently. Run 5–7 posts/day and decide after 35 posts. See
  [`growth-format-playbook.md`](./growth-format-playbook.md).
- **Posting safety:** autopost requires an accepted queue item and a
  successful provider response; manual posting records `prepared`, never
  `posted`.

## Practical caveat

The pipeline is technically working. The generated videos are still
low-quality until creative direction, footage selection, UGC actor support,
and post-render review improve. Treat the current release as infrastructure
and draft production, not final marketing quality.
