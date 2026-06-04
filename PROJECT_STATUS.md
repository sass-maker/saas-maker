# Project Status

Last updated: 2026-06-04

## Current Scope

Reel Pipeline is the SaaS Maker fleet's short-form video orchestration layer. It turns accepted marketing ideas and High Signal reel briefs into reviewable draft bundles, render jobs, artifacts, and gated posting handoff while SaaS Maker remains the source of truth for approvals and task linkage.

## Done

- VideoBrief contract, mock/MoneyPrinterTurbo/OpenShorts/reel-maker adapters, SaaS Maker sync.
- Signal intake from High Signal reel briefs and SaaS Maker improvement fixtures (`src/signal-intake.js`).
- **Prototype signal-to-reel draft generator** (`src/signal-draft-generator.js`): fixture brief → 2+ variant bundles (storyboard, script, shot list, captions) with claim/evidence review and unsupported-claim rejection.
- CLI: `npm run draft:signal -- --fixture test/fixtures/high-signal-reel-brief.json`
- Tests: `test/signal-draft-generator.test.js` (run via `npm test`).

## Planned Next

- Wire draft bundle output into review UI and optional render queue without paid engines.
- SaaS Maker task linkage for generated draft bundles.

## Deferred / Parked

- Real UGC actor pipeline (OpenShorts paid deps).
- Autopost provider wiring.
- Custom artifact domain.
