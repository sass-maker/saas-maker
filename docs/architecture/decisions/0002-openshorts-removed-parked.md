# ADR 0002: OpenShorts adapter removed, submodule parked

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
(`openshorts`/`ugc_actor` render modes now throw). Keep the git submodule at
`engines/openshorts` parked as a read-only UGC workflow reference. Defer
deletion of the submodule itself to a dedicated cleanup change requiring
explicit approval.

## Consequences

- The active render-mode matrix no longer includes OpenShorts; UGC actor
  support is a future, separately-gated decision.
- The submodule still appears in `git submodule status` and consumes disk on
  fresh clones; this is an explicit, tracked trade-off.
- `src/postiz-fixture-adapter.js` and `test/fixtures/postiz-contract.json`
  remain as an inert evaluator proving translation/account-isolation/metrics
  normalization without importing Postiz code — fixture success is not live
  readiness.

## Open follow-up

- Drop `engines/openshorts` git submodule in a dedicated PR after explicit
  approval. Tracked in `PROJECT_STATUS.md` under Deferred.
