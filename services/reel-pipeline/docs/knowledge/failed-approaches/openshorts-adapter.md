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

- The submodule stays parked at `engines/openshorts` as a read-only UGC
  workflow reference (removal is a separate, explicitly-approved cleanup).
- The pattern knowledge (MediaPipe face detection + YOLOv8 fallback for
  auto-cropping vertical 9:16, "Heavy Tripod" stabilization) is recorded in
  [`learnings/new-things.md`](../learnings/new-things.md) for future reference.

## What we learned

- Default renderers should be local-first and canary-able without API quota.
- UGC actor pipelines belong behind a separately-gated, paid-service-aware
  adapter — not the default factory.
- Parking a submodule as a reference is cheaper than re-cloning later, but it
  still costs disk on every fresh clone; track its removal explicitly.

## Decision

See
[`architecture/decisions/0002-openshorts-removed-parked.md`](../../architecture/decisions/0002-openshorts-removed-parked.md).
