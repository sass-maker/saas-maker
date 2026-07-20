# VideoBrief Contract & Render Modes

The `VideoBrief` is the normalization boundary between intake (SaaS Maker
Marketing Queue, High Signal briefs, Significant Hobbies envelopes, anonymous
brand URLs) and render engines. Every render adapter accepts a `VideoBrief`.

- Contract code: `src/video-brief.js` (Node) and `reel/src/brief.rs` (Rust).
  Both accept camelCase and snake_case keys.
- Validation covers channels (`tiktok`, `instagram_reels`, `youtube_shorts`),
  proof types, render modes, duration bounds, reel-body shape, and
  `toMoneyPrinterRequest` conversion.
- `POST /reels` and `POST /reels/signal` are the intake endpoints; the latter
  consumes High Signal reel briefs and SaaS Maker improvement signals.

## Render mode matrix

`config/render-modes.json` is the operator-facing source of truth for supported
modes, aliases, provider names, smoke coverage, and live-service requirements.
This table mirrors it; update the config first, then this table.

| Mode | Aliases | Category | Surface | Smoke |
| --- | --- | --- | --- | --- |
| `mock` | — | local | render-accepted | fixture accepted post renders to provider `mock` |
| `html-composition` | `html`, `web-composition` | local | render-accepted | fixture accepted post exports preview artifacts |
| `ascii` | `ascii-animation`, `ascii-fable`, `askai` | local | render-accepted | fixture accepted post renders an ASCII animation MP4 |
| `grok-video` | `grok`, `grok-videos` | local-asset | render-accepted | script creates a temp MP4 and runs local asset mode |
| `reel-maker` | `remotion` | local-remotion | render-accepted | adapter/orchestrator path with `REEL_MAKER_SKIP_REMOTION=1` |
| `moneyprinterturbo` | `stock` | service | render-accepted | `skip` unless `MONEYPRINTER_API_URL` is reachable; canary via `npm run canary:moneyprinter` |
| `render-pro` | `renderpro` | production | worker-reel-id | syntax check only; live proof mutates a real Worker reel + R2 object |
| `kokoro` | `kokoro-compose` | local | faceless-workflow | `npm run setup:kokoro` then readiness check |
| `brand-video` | — | local | content-package | `npm run render:package` against an approved content-package fixture |

Local/no-credential modes (`mock`, `html-composition`, `ascii`, `grok-video`,
`reel-maker`) are proven by `npm run smoke:render-modes`. Live-only modes
(`moneyprinterturbo`, `render-pro`) are tracked separately because they require
running services or mutate real state. See
[`operations/runbooks/generation-readiness.md`](../operations/runbooks/generation-readiness.md).

## Live generation readiness

`config/live-generation-readiness.json` maps local smokes, live canaries,
artifact playback, lesson prerequisites, posting prerequisites, and manual
creator review into one current-evidence report at
`tmp/generation-readiness/report.json`. `config/generation-cases.json` defines
the top-level generation cases: `marketing-render-modes`, `worker-render-pro`,
`lesson-video`, and `creator-mvp`.

The report separates `strictReady` (required local/live proofs green) from
`targetHostReady` (no remaining manual/missing target-host items except
documented accepted exclusions). Only `targetHostReady: true` means the host is
fully accepted. See
[`operations/runbooks/generation-readiness.md`](../operations/runbooks/generation-readiness.md)
and
[`operations/runbooks/target-host-readiness.md`](../operations/runbooks/target-host-readiness.md).
