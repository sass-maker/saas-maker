# Reel Pipeline Architecture

`reel-pipeline` is the video generation layer for SaaS Maker Marketing Queue.
It does not replace SaaS Maker; it turns accepted/generated marketing ideas into
reviewable video drafts.

## Control Plane

SaaS Maker remains the source of truth:

1. Agent creates a Marketing Queue item.
2. User accepts or rejects the item.
3. `reel-pipeline` converts an accepted item into a `VideoBrief`.
4. A render adapter creates a draft video.
5. The MP4, thumbnail, captions, logs, and provider metadata are attached back to the queue item.
6. Autopost only runs after explicit acceptance/scheduling.

## Engines

### MoneyPrinterTurbo

Default cheap path. Good for stock-footage videos with Edge TTS, subtitles,
background music, and FFmpeg/MoviePy composition.

Use it first because it is MIT licensed, heavily starred, actively maintained,
and runs with Docker or local Python. The first canary uses local generated
video/audio material only, so the renderer can be verified without API quota.

### Local review modes

`grok-video`, `ascii`, and `html-composition` are local/no-credential paths for
approved MP4 copies, stylized MP4s, and deterministic preview artifacts. They
use the same accepted-marketing-post contract as the real renderers.

### OpenShorts

OpenShorts is parked as a UGC workflow reference only. The active adapter was
removed from the renderer factory; the submodule remains until it is removed in
a dedicated cleanup change.

### reel-maker

Legacy/internal Remotion + Modal prototype. Keep it as a possible custom engine
for Modal-native renders after the `VideoBrief` contract stabilizes.

## Update Policy

Upstream engines should be pinned by commit. Do not auto-update. Upgrade on a
branch only after canary renders pass.

## Current Real-Renderer Probe

The local machine has the baseline prerequisites for a MoneyPrinterTurbo canary:

- Docker daemon responds.
- `uv sync --frozen --dry-run` works in `engines/MoneyPrinterTurbo`.
- FFmpeg is installed.

Use:

```bash
npm run probe:engines
```

This does not install dependencies or start a render. It only verifies that the
real-render path is plausible before spending time or API quota.

After MoneyPrinterTurbo is running, use:

```bash
npm run canary:moneyprinter
```

The canary writes generated local fixtures under the MoneyPrinterTurbo storage
folder, submits `POST /api/v1/videos`, polls `GET /api/v1/tasks/:id`, verifies
the output MP4 exists, and saves a machine-readable result in
`tmp/moneyprinter-canary-result.json`.

For the full generation matrix, run:

```bash
npm run check:generation-readiness -- --refresh --strict
```

That command reruns refreshable proofs and writes the consolidated report to
`tmp/generation-readiness/report.json`.
