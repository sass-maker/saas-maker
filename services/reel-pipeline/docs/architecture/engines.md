# Render Engines

Canonical reference for every render engine integrated into Reel Pipeline.
Engine facts live here; the adapter code lives under `src/adapters/` and
`reel/src/engine/`; the operator-facing mode matrix lives in
[`render-modes.md`](./render-modes.md) and `config/render-modes.json`.

## Strategy

- Default to cheap/local render paths first, then premium UGC actors when
  quality requires it.
- Keep render engines behind adapters under `src/adapters/`. Do not edit
  vendored upstream engines under `engines/*` unless there is no adapter-only
  path; prefer sending patches upstream.
- Every engine integration must have a smoke test that proves
  request → status → artifact metadata.
- `MoneyPrinterTurbo`: default cheap renderer for stock-footage + voice +
  subtitles.
- `OpenShorts`: UGC actor workflow reference and optional premium adapter
  (adapter removed; submodule parked — see
  [`decisions/0002-openshorts-removed-parked.md`](./decisions/0002-openshorts-removed-parked.md)).
- `reel-maker`: legacy Remotion/Modal engine; reuse pieces after the pipeline
  contract is stable.

## Pinned submodules

`reel-pipeline` pins upstream engines as git submodules. They are not copied
into the product layer and must not auto-update. Verify with:

```bash
git submodule status
```

| Engine | Path | Commit | Ref | Role |
| --- | --- | --- | --- | --- |
| MoneyPrinterTurbo | `engines/MoneyPrinterTurbo` | `bf229e20012e38f3bf161679fa98894b1e6f6d63` | `v1.2.8` | default cheap stock-footage renderer |
| openshorts | `engines/openshorts` | `fe87af6dd599b854e6eab2de0ca247ebafe13885` | `heads/main` | UGC actor + publishing workflow reference (adapter removed) |
| reel-maker | `engines/reel-maker` | `cedeeea002566bb81b2dff7b67ef852957fadbaf` | `heads/main` | internal Remotion + Modal prototype engine |

The pin manifest above is generated from `git submodule status`. Update it
intentionally, always alongside a passing render canary, and record the new
commit + artifact URL in the change description.

> Gotcha: `openshorts` and `reel-maker` float on `heads/main`, while
> MoneyPrinterTurbo is pinned to a tag. A bare `git submodule update --remote`
> silently advances the two floating engines without a canary — never run that
> on `main`. Use the upgrade flow in
> [`development/submodules.md`](../development/submodules.md).

## MoneyPrinterTurbo

- Upstream: `https://github.com/harry0703/MoneyPrinterTurbo` (MIT).
- Local path: `engines/MoneyPrinterTurbo`.
- Role: default cheap renderer for stock-footage reels. Good for stock-footage
  videos with Edge TTS, subtitles, background music, and FFmpeg/MoviePy
  composition.
- Why first: MIT licensed, heavily starred, actively maintained, and practical
  for fast MP4 generation. The first canary uses locally generated fixtures so
  the renderer can be verified without API quota.
- Dependencies: Python 3.11, FFmpeg, ImageMagick, one LLM provider, stock media
  source such as Pexels/Pixabay or local materials, optional Redis, optional
  Upload-Post.
- Current status: HTTP adapter implemented (`src/adapters/moneyprinterturbo.js`,
  `reel/src/engine/moneyprinter.rs`); local canary implemented; real MP4 upload
  to R2 verified.

## Grok / Imagine local MP4s

- Source: local MP4 exports generated outside this repo (e.g. Grok Imagine
  science clips). No Grok credentials or API calls live in this repo.
- Role: curated premium/source footage when a finished clip already exists;
  clips can be inserted into normal generated reels or published as a standalone
  `grok-video` render.
- Configure: set `GROK_VIDEO_ASSET_DIR` to a folder containing `.mp4` exports.
- Current status: `grok-video` render mode implemented in Node and Rust;
  `render-pro.js` can also insert one matching Grok clip as a motion scene when
  `GROK_VIDEO_ASSET_DIR` is set.

## ASCII animation inserts

- Source: local generated ASCII/pixel animation inspired by
  `adithyaakrishna/ascii-fable`.
- Role: stylized subsection/interlude footage for explaining abstract ideas
  between higher-fidelity Grok/Imagine or product-proof scenes. Deterministic
  generated motion; no API credentials or external model calls required.
- Configure: render mode `ascii`, `ascii-animation`, `ascii-fable`, or `askai`.
  High-quality path renders HTML terminal art through headless Chrome, then
  assembles MP4s with `ffmpeg`; set `REEL_ASCII_RENDERER=raster` for the faster
  no-Chrome fallback, or `FFMPEG_PATH` if needed.
- Current status: Node adapter implemented; Rust orchestrator shells out to the
  same Node renderer for parity.

## Editframe-inspired HTML composition

- Upstream: `https://editframe.com/`.
- Role: agent-friendly preview format for videos as deterministic HTML/CSS
  scenes with a timeline and word-level caption cues. Not a posting-ready MP4.
- Why not depend on it: keep Reel Pipeline local-first and avoid adding another
  production video runtime before the preview contract proves useful. See
  [`decisions/0004-postiz-editframe-patterns-not-code.md`](./decisions/0004-postiz-editframe-patterns-not-code.md).
- Configure: render mode `html`, `html-composition`, or `web-composition`.
  Output is `composition.html`, `timeline.json`, and `captions.json`.
- Current status: Node adapter implemented; Rust orchestrator shells out to the
  same Node exporter for parity.

## Kokoro local voice

- Source: Kokoro-82M running locally via `kokoro-onnx`
  (`npm run setup:kokoro`, `tools/kokoro/`, gitignored, ~340MB model).
- Role: fully local narration for the faceless workflow and lesson videos; no
  network at synth time. Removes the ElevenLabs live-prerequisite for lessons
  when installed (`LESSON_TTS_PROVIDER=kokoro`).
- Current status: shipped; live proof 40.6s 1080×1920 h264 render end-to-end.

## reel-maker

- Upstream: `https://github.com/sarthakagrawal927/reel-maker`.
- Local path: `engines/reel-maker`.
- Role: older internal Remotion + Modal prototype. Kept as a reference engine.
  It should either be superseded by this repo or reused behind the same
  `VideoBrief` adapter contract.
- Current status: Remotion shell-out adapter (`src/adapters/reel-maker.js`,
  `reel/src/engine/reel_maker.rs`); the `remotion` mode. Lower priority than
  `render-pro.js`, which is the canonical production renderer.

## OpenShorts (parked)

- Upstream: `https://github.com/mutonby/openshorts` (MIT).
- Local path: `engines/openshorts`.
- Role: UGC actor and publishing workflow reference.
- Why not default: it assumes more paid/hosted services such as Gemini,
  fal.ai, ElevenLabs, Upload-Post, and optional S3.
- Current status: adapter removed from the active pipeline; the submodule is
  parked as a reference only. Removal of the submodule itself is a deferred
  cleanup item requiring explicit approval. See
  [`knowledge/failed-approaches/openshorts-adapter.md`](../knowledge/failed-approaches/openshorts-adapter.md)
  and [`decisions/0002-openshorts-removed-parked.md`](./decisions/0002-openshorts-removed-parked.md).

## render-pro.js (canonical production renderer)

- Not exposed through the Rust engine factory; it is its own production renderer
  driven by the watcher. `render-pro.js` (~1680 LOC) is self-contained: Chrome
  CDP scroll-tour + live screencast of the product URL, Edge TTS voiceover
  (`uvx`) → SRT-synced burned-in captions, ffmpeg scene cards / Ken Burns /
  xfade stitch / ambient bed / SFX, `npx wrangler r2 object put` upload, and
  Worker reel-record patch. The Rust CLI drives it via
  `RenderProEngine` → `node scripts/render-pro.js <reelId>`.

## Cloudflare artifact hosting

- Worker: `reel-pipeline-artifacts` (`src/worker/index.js`).
- R2 bucket: `reel-artifacts`.
- Live artifact base URL:
  `https://reel-pipeline-artifacts.sarthakagrawal927.workers.dev`.
- Routes: `GET /health`, `GET /reels/:key` (byte-range enabled so MP4 playback
  works in browsers).
- The Rust `artifact.rs` mirrors the Worker's `isSafeKey`/`contentTypeFor`/range
  logic; if the Worker is ever rewritten, keep that logic in sync via a spec.

## Credits & inspiration (patterns, not code)

Design ideas borrowed from other open-source projects — concepts adapted, code
not copied:

- **OpenMontage** (`https://github.com/calesthio/OpenMontage`, AGPLv3) —
  agent-first video production system whose runtime we deliberately did not
  adopt. We reused two quality gates: slideshow-risk scoring
  (`src/reel-quality.js`) and post-render self-review with `ffprobe`
  (`src/reel-self-review.js`).
- **Postiz** (`https://github.com/gitroomhq/postiz-app`, AGPLv3) — social
  publishing workflow reference. We reimplemented selected patterns (provider
  capabilities/preflight, classified posting failures, per-post isolation,
  missed-post recovery, metrics backfill, release IDs) without copying source
  or adopting its NestJS/Prisma/Temporal runtime. See
  [`decisions/0004-postiz-editframe-patterns-not-code.md`](./decisions/0004-postiz-editframe-patterns-not-code.md).
- **Editframe** — see HTML composition above; pattern source only.
