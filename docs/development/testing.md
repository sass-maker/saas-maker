# Testing & Verification

## Unit tests

```bash
npm test
```

Runs Node `--test` (with `--experimental-strip-types`) and
`cargo test --quiet --manifest-path reel/Cargo.toml`. The latest local run
covered ~202 Node tests, ~93 Rust tests, and 3 Rust integration tests.

Coverage thresholds (when run):

```bash
npm run test:coverage   # 20% lines / 25% functions on src/**/*.js
```

## Smokes

Smokes prove end-to-end paths without the full live stack. Run the ones
relevant to your change. The full set:

```bash
npm run smoke:mock                 # no-dependency end-to-end
npm run smoke:full                 # full pipeline + manual posting fallback
npm run smoke:generation-cases     # top-level readiness matrix
npm run smoke:render-modes         # local/no-credential render modes
npm run smoke:reel-maker           # Remotion adapter
npm run smoke:artifact             # live R2 byte-range playback (needs worker URL)
npm run smoke:studio               # content studio (13 checks)
npm run smoke:lesson-local         # lesson lifecycle with fake adapters
npm run smoke:significant-content  # versioned handoff/idempotency/receipt
```

## Readiness gates

The readiness matrix is the operator checklist for promoting a host from
locally-ready to target-host-ready. Full detail in
[`operations/runbooks/generation-readiness.md`](../operations/runbooks/generation-readiness.md)
and
[`operations/runbooks/target-host-readiness.md`](../operations/runbooks/target-host-readiness.md).

```bash
npm run ready:local    # local generation-cases smoke
npm run ready:proofs   # refresh every refreshable proof, then validate
npm run ready:target   # final target-host acceptance (exits non-zero unless targetHostReady)
```

The report at `tmp/generation-readiness/report.json` separates `strictReady`
(required local/live proofs green) from `targetHostReady` (no remaining
manual/missing items except documented accepted exclusions). Only
`targetHostReady: true` means the host is fully accepted.

## Live render proofs

Use these before calling a host fully ready. Evidence commands in
[`operations/runbooks/generation-readiness.md`](../operations/runbooks/generation-readiness.md).

| Case | Command |
| --- | --- |
| MoneyPrinterTurbo real MP4 | `MONEYPRINTER_API_URL=http://127.0.0.1:18080 npm run canary:moneyprinter` |
| Full reel-maker/Remotion | `npm run smoke:reel-maker` |
| Production `render-pro` | `npm run render:pro -- <approved-reel-id>` |
| Artifact Worker/R2 playback | `npm run smoke:artifact` (with `REEL_ARTIFACT_BASE_URL` + `REEL_ARTIFACT_SMOKE_KEY`) |
| Accepted marketing render to R2 | `npm run render:accepted -- --mode moneyprinterturbo --limit 1 --artifact-r2-bucket reel-artifacts --artifact-base-url <worker-url>/reels` |

## Release baseline

```bash
npm test
npm run worker:dry-run
npm run check:cloudflare
REEL_ARTIFACT_BASE_URL=https://reel-pipeline-artifacts.sarthakagrawal927.workers.dev \
  REEL_ARTIFACT_SMOKE_KEY=fixture-real-render.mp4 \
  npm run smoke:artifact
```

SaaS Maker fleet integration lives in `../saas-maker/foundry.projects.json`,
`../saas-maker/scripts/lib/fleet-health-contracts.mjs`, and
`../saas-maker/scripts/fleet-production-smoke.mjs`.

## Completion rule

Do not treat this repository as fully ready for all generation cases until:

1. `npm test` passes.
2. `npm run smoke:generation-cases` passes all generation-case checks.
3. `npm run smoke:render-modes` passes local modes (keep
   `tmp/render-mode-smoke/report.json` as evidence).
4. `npm run smoke:full` passes and writes `tmp/full-pipeline-smoke/report.json`.
5. Every live render proof relevant to the target host has current evidence.
6. Posting proof is complete for the provider accounts that will be enabled.
7. `npm run check:generation-readiness -- --refresh --strict` passes.
8. `npm run ready:target` passes, or every remaining unresolved check has a
   documented target-host exception; the report shows `targetHostReady: true`.
9. `PROJECT_STATUS.md` reflects any remaining skipped or deferred cases.
