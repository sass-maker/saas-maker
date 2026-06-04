# reel-pipeline — project status

## Shipped

- VideoBrief contract, mock/MoneyPrinterTurbo/OpenShorts/reel-maker adapters, SaaS Maker sync.
- Signal intake from High Signal reel briefs and SaaS Maker improvement fixtures (`src/signal-intake.js`).
- **Prototype signal-to-reel draft generator** (`src/signal-draft-generator.js`): fixture brief → 2+ variant bundles (storyboard, script, shot list, captions) with claim/evidence review and unsupported-claim rejection.
- CLI: `npm run draft:signal -- --fixture test/fixtures/high-signal-reel-brief.json`
- Tests: `test/signal-draft-generator.test.js` (run via `npm test`).

## Next

- Wire draft bundle output into review UI and optional render queue without paid engines.
- SaaS Maker task linkage for generated draft bundles.

## Deferred

- Real UGC actor pipeline (OpenShorts paid deps).
- Autopost provider wiring.
- Custom artifact domain.
