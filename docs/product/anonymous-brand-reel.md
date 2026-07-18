# Anonymous Brand Reel

The public product does one thing: paste a public HTTPS brand website and get
a presenter-led vertical reel. There is no login, account, billing, workspace,
actor onboarding, or social connection in this flow.

## Flow

```text
public HTTPS brand URL
   │
   ▼
website-intake.js  (DNS-pinned, SSRF-safe bounded fetch; ≤3 docs, ≤12 images)
   │   extracts cited brand facts + visuals
   ▼
brand-brief.js     (evidence-backed script/storyboard → VideoBrief)
   │
   ▼
renderer.js        (presenter-led 9:16 composition boundary)
   │   checksum-pinned fictional synthetic human presenter
   ▼
artifact + safe status + byte-range preview + attachment download
   (exposed only after review)
```

## Boundary

- No authentication, workspaces, billing, credits, actor onboarding/twins,
  KYC, earnings, payouts, marketplace, customer social posting, or scheduling.
- Website intake is bounded: DNS-pinned to public HTTPS, max 3 same-origin
  documents, max 12 images, max 1MB per document, 10s timeout, max 3
  redirects. Private/loopback/link-local hosts are rejected.
- The presenter pack (`assets/presenters/manifest.json`) carries a verified
  SHA-256 checksum, generator provenance, and an explicit
  `fictionalIdentity: true` attestation. Real likenesses remain fail-closed
  without model-release proof.
- Status, range preview, and attachment download expose only the reviewed
  artifact.

## Code

- `src/anonymous-video/website-intake.js` — bounded, DNS-pinned HTTPS fetch +
  brand evidence extraction.
- `src/anonymous-video/brand-brief.js` — evidence-backed `VideoBrief` builder.
- `src/anonymous-video/renderer.js` — presenter-led 9:16 composition.
- `src/anonymous-video/presenter-library.js` — manifest load + checksum +
  provenance validation.
- `src/anonymous-video/service.js` — job store + async processing.
- `src/anonymous-video/ui.js` / `artifact-response.js` — root page + safe
  artifact response.
- `src/server/index.js` — serves `GET /` (anonymous page), `POST /videos`,
  `GET /videos/:id`, `GET /videos/:id/preview`, `GET /videos/:id/download`.

## Run

```bash
npm run dev
# open http://127.0.0.1:4317/ and submit a brand URL
```

## Decision

See
[`architecture/decisions/0005-anonymous-no-auth-product-boundary.md`](../architecture/decisions/0005-anonymous-no-auth-product-boundary.md).

## Open item

A production-environment canary with the checksum-pinned synthetic presenter
remains an operator release gate. Auth/billing/actor/social scope is
explicitly out.
