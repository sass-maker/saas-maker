# Failed approach: OpenShorts as a default UGC renderer

## What was tried

OpenShorts (`https://github.com/mutonby/openshorts`, MIT) was wired in as a
UGC actor / ReelFarm-style workflow renderer alongside MoneyPrinterTurbo. The
adapter deliberately wrote only a guarded job spec to avoid accidental
paid-service calls.

## Why it failed here

- **Cost/runtime surface:** OpenShorts assumes Docker Compose, Gemini,
  fal.ai, ElevenLabs, Upload-Post, optional S3, and PyTorch/YOLO/MediaPipe/
  faster-whisper. That is a large paid/hosted dependency surface for a
  default renderer.
- **Premature UGC:** real UGC actor support was not the next useful step; the
  pipeline contract and quality gates were not yet stable.
- **Adapter discipline:** the adapter had to be guarded to avoid accidental
  paid calls, which is a sign the integration does not fit the local-first
  default.

## What we kept

- The upstream repository link remains the read-only UGC workflow reference;
  the local submodule was removed after explicit approval on 2026-07-20.
- The pattern knowledge (MediaPipe face detection + YOLOv8 fallback for
  auto-cropping vertical 9:16, "Heavy Tripod" stabilization) is recorded in
  [`learnings/new-things.md`](../learnings/new-things.md) for future reference.

## What we learned

- Default renderers should be local-first and canary-able without API quota.
- UGC actor pipelines belong behind a separately-gated, paid-service-aware
  adapter — not the default factory.
- A public upstream link is sufficient for a rejected engine; a parked
  submodule makes every fresh clone pay for code the product cannot execute.

## Decision

See
[`architecture/decisions/0002-openshorts-removed-parked.md`](../../architecture/decisions/0002-openshorts-removed-parked.md).
