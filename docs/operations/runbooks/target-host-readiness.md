# Target Host Readiness

Use this checklist when promoting Reel Pipeline from locally-ready to ready for
a specific host/account setup. Do not store secrets in this file.

The machine gate for final acceptance is:

```bash
npm run ready:target
```

It exits non-zero unless `targetHostReady` in
`tmp/generation-readiness/report.json` is true, and it refreshes every
refreshable proof command before checking that value.
The same report exposes `targetHostReady`; it should be `true` only after all
manual/missing items are closed or accepted with documented evidence.
When it is false, use `targetHostNextActions` in the report, or the `next ...`
lines in the CLI output, as the current queue of host-specific work to close.
Use `npm run ready:proofs` when you only need to refresh required render,
artifact, and fallback proof reports without failing on manual target-host
items.

If a target host intentionally excludes a case, copy
`config/target-host-acceptance.example.json` to a host-specific file outside
secrets storage and run:

```bash
npm run check:generation-readiness -- --refresh --strict --fail-unresolved --acceptance <acceptance.json>
```

The acceptance file must include `$schema:
reel-pipeline.target-host-acceptance.v1` and a concrete `targetHost`. Each
accepted unresolved item must include a `name`, `reason`, and `evidence`.
Do not include API keys, OAuth tokens, or credential material.
Acceptance entries are validated against the current unresolved check list.
Stale names, wrong or missing `$schema`, missing `targetHost`, missing reasons,
and missing evidence are reported as `invalidAcceptances` and fail
`--fail-unresolved`.

## Unresolved Checks

### `render-pro-live-proof`

Status source: `config/live-generation-readiness.json`
Generation case: `worker-render-pro`

Evidence required:

- Run `npm run render:pro -- <approved-reel-id>` on the target host.
- Confirm the Worker reel record has `renderJobId`, `renderedAt`, `assetUrl`,
  and at least one rendered variant.
- Confirm the R2-backed MP4 URL is reachable from the artifact Worker.
- Confirm browser playback can fetch a byte range for the MP4.

Record acceptance:

- Save the approved reel id, artifact URL, and observation date in the release
  notes or host runbook.
- Keep `render-pro-live-proof` unresolved until that evidence exists.

### `lesson-live-prereqs`

Status source: environment variables
Generation case: `lesson-video`

Evidence required:

- `DEEPSEEK_API_KEY`
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_VOICE_ID`
- `PEXELS_API_KEY`
- Local `ffmpeg`

Proof command:

```bash
npm run lesson:render -- --input test/fixtures/lessons/closures.json --auto-approve
```

Record acceptance:

- Confirm `.reel-pipeline/lessons/<lesson-id>.json` records variant metadata.
- Confirm `artifacts/lessons/<lesson-id>/<variant-id>.mp4` exists.
- Confirm transcript, hashtags, and captions files exist beside the MP4.

### `social-posting-prereqs`

Status source: environment variable groups
Generation case: `marketing-render-modes`

At least one provider group is required for auto posting:

- YouTube: `YOUTUBE_OAUTH_CLIENT_ID`, `YOUTUBE_OAUTH_CLIENT_SECRET`,
  `YOUTUBE_OAUTH_REFRESH_TOKEN`
- Instagram: `IG_APP_ID`, `IG_APP_SECRET`

Proof command:

```bash
npm run post:ready -- --posting-provider auto --limit 1
```

Record acceptance:

- Confirm the provider returns a real platform id.
- Confirm SaaS Maker notes include provider metadata and `external_id`.
- Confirm failed provider attempts are classified without marking the post sent.

### `creator-mvp-reviewed`

Status source: manual creator review
Generation case: `creator-mvp`

Evidence required:

- Produce and review the three public-domain story packets under
  [`product/creator-mvp-packs/`](../../product/creator-mvp-packs/).
- Record watch/parent-trust notes for each video.
- Decide whether to keep this as a manual creator workflow or add only
  scene/asset manifest support.

Record acceptance:

- Keep this manual until the creator review exists.
- Do not add new kids-story automation before the three review notes exist.

## Acceptance Notes

If a target host intentionally does not support one of these cases, document the
exception in an acceptance file and keep the reason/evidence concrete. Remove
or downgrade a matrix check only when the product scope changes, not to make the
gate pass.
