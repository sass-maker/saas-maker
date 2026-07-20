# ADR 0002: OpenShorts removed

- **Status:** Accepted
- **Date:** 2026-07 (Phase 6 consolidation)

## Context

OpenShorts (`https://github.com/mutonby/openshorts`, MIT) is a UGC actor and
publishing workflow reference. It assumes paid/hosted services (Gemini,
fal.ai, ElevenLabs, Upload-Post, optional S3) and a heavy runtime
(Docker Compose, PyTorch/YOLO/MediaPipe/faster-whisper). Wiring it as a
default renderer would pull in a large dependency surface and paid-service
calls before the pipeline contract was stable.

## Decision

Remove the OpenShorts adapter from the active renderer factory
(`openshorts`/`ugc_actor` render modes now throw). The parked git submodule was
also removed after explicit owner approval on 2026-07-20; upstream history
remains available at its public repository.

## Consequences

- The active render-mode matrix no longer includes OpenShorts; UGC actor
  support is a future, separately-gated decision.
- Fresh clones no longer download the unused OpenShorts dependency tree.
- `src/postiz-fixture-adapter.js` and `test/fixtures/postiz-contract.json`
  remain as an inert evaluator proving translation/account-isolation/metrics
  normalization without importing Postiz code — fixture success is not live
  readiness.
