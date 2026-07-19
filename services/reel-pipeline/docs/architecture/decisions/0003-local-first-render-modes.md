# ADR 0003: Local-first, no-credential render modes

- **Status:** Accepted
- **Date:** 2026-07

## Context

The pipeline needs reviewable artifacts and tests that run without paid
services, API quota, or network egress. Relying solely on MoneyPrinterTurbo
(a running Python service) or `render-pro` (Chrome + ffmpeg + R2) would make
every smoke and draft cycle depend on live infrastructure.

## Decision

Ship a set of local, no-credential render modes that share the same
accepted-marketing-post / `VideoBrief` contract as the real renderers:

- `mock` — placeholder renderer for tests and dry runs.
- `html-composition` — deterministic HTML/CSS preview + `timeline.json` +
  word-level `captions.json` (Editframe-inspired pattern, no SDK dependency).
- `ascii` — generated ASCII/pixel interlude MP4s (local Chrome HTML terminal
  art with a raster fallback).
- `grok-video` — copies approved local Grok/Imagine MP4 exports; no Grok
  credentials in repo.
- `reel-maker` — Remotion shell-out adapter, skippable via
  `REEL_MAKER_SKIP_REMOTION=1` for adapter/orchestrator-only smokes.
- `kokoro` — fully local faceless renderer: Kokoro-82M narration (local ONNX)
  + Pexels b-roll + FFmpeg compose.
- `brand-video` — source-backed brand motion graphics with local Kokoro,
  Chromium frames, and FFmpeg.

## Consequences

- `npm run smoke:render-modes` proves the unified `render:accepted` path for
  every local mode without external credentials.
- Live-only modes (`moneyprinterturbo`, `render-pro`) are reported separately
  in the readiness matrix because they require running services or mutate real
  state.
- Draft and review cycles can run end-to-end on a laptop at $0; paid services
  are opt-in upgrades, not prerequisites.
- The mode matrix is the operator-facing source of truth
  (`config/render-modes.json`); see
  [`render-modes.md`](../render-modes.md).
