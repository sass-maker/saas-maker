# Generation Readiness

This is the operator checklist for the different generation paths in Reel
Pipeline. The source of truth for render modes is
[`config/render-modes.json`](../config/render-modes.json).

## Local Readiness

Run this first on any machine:

```bash
npm run ready:local
```

The generation-cases command writes machine-readable evidence to
`tmp/generation-cases-smoke/report.json`. The render-modes command writes to
`tmp/render-mode-smoke/report.json`. The readiness command reads
[`config/live-generation-readiness.json`](../config/live-generation-readiness.json)
and writes the consolidated current evidence report to
`tmp/generation-readiness/report.json`. Each readiness check includes
`generationCases`, so unresolved report entries identify which top-level case is
not fully ready yet. The report separates `strictReady` from
`targetHostReady`: `strictReady` means required local/live proofs are green;
`targetHostReady` means there are no remaining manual or missing target-host
items, except documented accepted exclusions. `generationCaseReadiness` gives
the same decision per top-level generation case, including open checks with
their command/detail and accepted checks with reason/evidence. The CLI also
prints a compact `case <name>` line for each entry so the open case blockers are
visible in terminal output. `targetHostNextActions` is the machine-readable
queue of open blocking/manual/missing items, including the generation cases,
detail, proof command, and docs link. When an acceptance file is passed, the
report also records `acceptanceSchema` and `acceptanceTargetHost`.

Use `--refresh --strict` when you want the readiness command to rerun every
refreshable proof command before validating reports. MoneyPrinter refresh
expects `npm run moneyprinter:api` to already be running in another terminal.
Readiness commands use a 10 minute default timeout. Set `timeoutMs` on a matrix
entry, or `GENERATION_READINESS_TIMEOUT_MS` for the whole run, when a target
host legitimately needs more time.

Full host gate:

```bash
npm run moneyprinter:api
# in another terminal
npm run ready:proofs
```

Final target-host acceptance gate:

```bash
npm run ready:target
```

Use this after the target host has live `render-pro`, lesson, posting, and
manual creator-review evidence. It refreshes every refreshable proof command
and exits non-zero unless `targetHostReady` is true.
Use [`target-host-readiness.md`](target-host-readiness.md) to close or record
exceptions for unresolved target-host checks.
When a target host intentionally excludes a case, pass a documented acceptance
file with `npm run check:generation-readiness -- --strict --fail-unresolved
--acceptance <acceptance.json>`. The final report should show
`targetHostReady: true`.

`smoke:generation-cases` covers marketing render modes, the Worker
`render-pro` entrypoint, lesson-video local orchestration, and manual creator
packet presence. `smoke:render-modes` proves the unified `render:accepted` path
for local/no-credential modes:

| Mode | Proof |
| --- | --- |
| `mock` | fixture accepted post renders to provider `mock` |
| `html-composition` | fixture accepted post exports preview artifacts |
| `ascii` | fixture accepted post renders an ASCII animation MP4 |
| `grok-video` | script creates a temporary MP4 and runs local asset mode |
| `reel-maker` | adapter/orchestrator path runs with `REEL_MAKER_SKIP_REMOTION=1` |

The command also reports live-only checks:

| Mode | Local result | What it means |
| --- | --- | --- |
| `moneyprinterturbo` | `skip` unless API is reachable | Start MoneyPrinterTurbo before claiming real stock-footage readiness |
| `render-pro` | syntax check only | Live proof is tracked separately because it mutates a real Worker reel record and R2 object |

## Live Render Proof

Use these commands before calling a host fully ready.

| Case | Command | Evidence |
| --- | --- | --- |
| MoneyPrinterTurbo real MP4 | `MONEYPRINTER_API_URL=http://127.0.0.1:18080 npm run canary:moneyprinter` | `tmp/moneyprinter-canary-result.json` with `ok: true` and output size > 1024 bytes |
| Full reel-maker/Remotion | `npm run smoke:reel-maker` | `tmp/reel-maker-smoke/report.json` has `ok: true` and at least one `video_ready` or `needs_review` variant |
| Production `render-pro` | `npm run render:pro -- <approved-reel-id>` | Worker reel is patched with render metadata and R2 serves the MP4 |
| Artifact Worker/R2 playback | `REEL_ARTIFACT_BASE_URL=https://reel-pipeline-artifacts.sarthakagrawal927.workers.dev REEL_ARTIFACT_SMOKE_KEY=fixture-real-render.mp4 npm run smoke:artifact` | `tmp/artifact-live-smoke/report.json` records health, full fetch, and byte-range MP4 success |
| Accepted marketing render to R2 | `npm run render:accepted -- --mode moneyprinterturbo --limit 1 --artifact-r2-bucket reel-artifacts --artifact-base-url <worker-url>/reels` | SaaS Maker post receives public `asset_url` |

If `npm run canary:moneyprinter` reports that `/docs` and `/openapi.json`
failed on `127.0.0.1:8080`, another local service is probably using the default
MoneyPrinterTurbo API port. Start MoneyPrinterTurbo on the repo-standard free
port in one terminal:

```bash
npm run moneyprinter:api
```

Then run the canary in another terminal:

```bash
MONEYPRINTER_API_URL=http://127.0.0.1:18080 npm run canary:moneyprinter
```

## Lesson Video Proof

The tutoring lesson generator is separate from the marketing render-mode
matrix. It needs API keys for DeepSeek, ElevenLabs, and Pexels.

Local no-credential smoke:

```bash
npm run smoke:lesson-local
```

This writes `tmp/lesson-local-smoke/report.json` and proves the lesson draft →
script → render metadata lifecycle with fake local adapters.

```bash
npm run lesson:render -- --input test/fixtures/lessons/closures.json --auto-approve
```

Evidence:

- `.reel-pipeline/lessons/<lesson-id>.json` exists and records variant metadata.
- `artifacts/lessons/<lesson-id>/<variant-id>.mp4` exists.
- Transcript, hashtags, and captions files exist beside the MP4.

## Posting Proof

Rendering readiness is separate from posting readiness.

| Case | Command | Evidence |
| --- | --- | --- |
| Manual handoff fallback | `npm run post:ready -- --fixture test/fixtures/post-ready-marketing-posts.json --posting-provider manual --confirm-post --limit 1` | result status is `prepared`; `posted_at` is not set |
| YouTube account config | `npm run yt:bootstrap` then `npm run post:ready -- --posting-provider auto --limit 1` | SaaS Maker notes include provider `youtube` and platform `external_id` |
| Instagram account config | `npm run ig:bootstrap` then `npm run post:ready -- --posting-provider auto --limit 1` | SaaS Maker notes include provider `instagram` and platform `external_id` |
| Metrics backfill | `npm run sync:metrics` | SaaS Maker notes include refreshed metric fields |

## Completion Rule

Do not treat this repository as fully ready for all generation cases until:

1. `npm test` passes.
2. `npm run smoke:generation-cases` passes all generation-case checks.
3. `npm run smoke:render-modes` passes local modes.
   Keep `tmp/render-mode-smoke/report.json` from the run as evidence.
4. `npm run smoke:full` passes and writes
   `tmp/full-pipeline-smoke/report.json` for the manual posting fallback.
5. Every live render proof relevant to the target host has current evidence.
6. Posting proof is complete for the provider accounts that will be enabled.
7. `npm run check:generation-readiness -- --refresh --strict` passes for the
   required refreshed proof set.
8. `npm run ready:target` passes, or every remaining unresolved check in
   `tmp/generation-readiness/report.json` has a documented target-host
   exception using `docs/target-host-readiness.md`; the report shows
   `targetHostReady: true`.
9. `PROJECT_STATUS.md` reflects any remaining skipped or deferred cases.
