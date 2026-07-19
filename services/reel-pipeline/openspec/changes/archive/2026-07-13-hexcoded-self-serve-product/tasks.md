# Tasks — anonymous brand website to reel

## 1. Product boundary

- [x] 1.1 Replace the authenticated marketplace plan with the anonymous URL-to-reel scope.
- [x] 1.2 Remove obsolete auth, workspace, billing, credit, actor marketplace, payout, and product-publishing paths and tests.
- [x] 1.3 Preserve independent internal studio, review, and accepted-marketing pipeline behavior.

## 2. Website intake and brand brief

- [x] 2.1 Add HTTPS-only SSRF-safe fetch with DNS and redirect validation plus bounded time/bytes/documents/images.
- [x] 2.2 Extract canonical brand facts, colors, logo/product images, and page captures with per-item source provenance.
- [x] 2.3 Generate an evidence-backed script/storyboard without unsupported factual claims.
- [x] 2.4 Add fixture coverage for normal sites, redirects, private targets, oversized responses, sparse evidence, and extraction failure.

## 3. Presenter-led rendering

- [x] 3.1 Add a checksum-pinned presenter manifest with commercial-use rights and likeness-appropriate provenance. (The production pack contains a fictional synthetic human generated for this product; real likenesses still require model-release proof.)
- [x] 3.2 Validate presenter assets and proof at composition time and fail closed on mismatch or absence.
- [x] 3.3 Compose a 9:16 MP4 with presenter, brand/product visuals, narration, captions, on-screen text, and CTA using existing adapters.
- [x] 3.4 Record website, asset, presenter, voice, renderer, timing, and review provenance on the artifact.

## 4. Anonymous product surface

- [x] 4.1 Add the one-field public URL form and clear processing/error/completion states.
- [x] 4.2 Add `POST /api/videos` and safe status responses at `GET /api/videos/:id`.
- [x] 4.3 Add reviewed-artifact preview and download routes with byte-range support.
- [x] 4.4 Ensure account, billing, marketplace, actor, and posting product routes return not found.

## 5. Verification and handoff

- [x] 5.1 Add fixture integration coverage for URL -> brief -> render request -> reviewed artifact metadata.
- [x] 5.2 Add an FFmpeg smoke proving 9:16 video, visible presenter, audio, captions, and playable range metadata.
- [x] 5.3 Run focused and full regression checks, update `PROJECT_STATUS.md`, and push the implementation branch.
- [x] 5.4 Keep deployment and production configuration changes gated on explicit approval.
