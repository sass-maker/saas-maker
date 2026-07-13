# Design — anonymous brand website to reel

## Product boundary

```text
Public URL form
  -> safe website intake
  -> cited brand brief
  -> script + storyboard
  -> provenance-safe human presenter + brand visuals
  -> existing render/review core
  -> preview + MP4 download
```

There is no identity, workspace, purchase, credit, marketplace, or publishing
layer. A generated job is addressed by an unguessable job identifier. The job
store may remain local for this first product slice; the API must not imply
multi-tenant privacy guarantees it does not provide.

## Website intake

Accept only `https:` URLs. Resolve DNS before every request and reject loopback,
link-local, private, multicast, reserved, and metadata-service addresses for
IPv4 and IPv6. Apply the same checks to redirects. Use bounded redirects,
timeouts, response bytes, document count, and image count.

Extract:

- canonical URL, title, description, headings, and high-confidence product facts;
- logo, product/hero images, palette, and typography hints;
- desktop/mobile page captures when the existing capture path is available;
- a provenance entry containing the source URL for every retained claim/asset.

Do not execute arbitrary downloaded code, submit forms, crawl authenticated
pages, or infer unsupported claims.

## Creative plan

Convert the evidence into a short brief with hook, audience-neutral value
proposition, scene narration, on-screen text, CTA, and asset references. Claims
without source evidence are removed or rewritten as non-factual creative copy.

The default output is 1080x1920, 24–30 fps, and approximately 15–30 seconds.
The presenter appears prominently in the opening and at least one later scene;
supporting scenes use brand imagery, captured page regions, kinetic text, and
subtle generated backgrounds. Captions remain in safe areas.

## Human presenter

Use a curated, checksum-pinned presenter pack. Every presenter manifest entry
must include asset path, checksum, commercial-use rights reference, attribution
requirements, and allowed transformations. A real likeness also requires a
model release. A fictional synthetic human instead requires generator, creation
date, generation reference, and an explicit non-real-identity attestation.
Composition fails closed when the asset or its applicable proof is missing or
mismatched.

This is a curated presenter treatment, not customer actor casting, biometric
cloning, or an AI-twin marketplace. Generated voice remains behind the existing
provider adapter and is recorded in output provenance.

## Rendering and delivery

Reuse existing `VideoBrief`, renderer adapters, FFmpeg composition, job state,
self-review, and artifact response helpers. The anonymous service owns the thin
orchestration boundary:

- `POST /api/videos` validates/fetches the URL and creates a job;
- `GET /api/videos/:id` returns safe status and error details;
- `GET /api/videos/:id/preview` streams inline with byte ranges;
- `GET /api/videos/:id/download` returns the MP4 as an attachment;
- `GET /` renders the URL form and current job state.

No route publishes, schedules, charges, signs in, or connects an account.

## Failure behavior

- Unsafe URL: reject before network access.
- Site fetch/extraction failure: terminal, actionable intake error.
- Insufficient evidence/assets: return a brief-quality error; do not invent facts.
- Missing presenter rights/provenance/checksum: block render.
- Renderer failure: preserve the classified error and never expose a partial
  file as complete.
- Review failure: mark `needs_review` or `failed`; do not call it downloadable.

## Verification

- Unit tests for URL/DNS/redirect safety, extraction bounds, claim provenance,
  presenter manifest validation, and route responses.
- Integration test from fixture website -> brief -> render request -> completed
  artifact metadata using fake fetch/render adapters.
- FFmpeg smoke proving a 9:16 MP4 with presenter, captions, audio, and range
  playback metadata.
- Regression tests proving retained internal review/studio paths still work and
  obsolete product routes are absent.
