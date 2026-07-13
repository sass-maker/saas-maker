# Anonymous brand website to reel

## Why

Reel Pipeline already contains useful render, review, and artifact primitives,
but the prior HexCoded plan expanded into accounts, billing, credits, an actor
marketplace, payouts, KYC, and social posting. That is not the product.

The product should do one thing well: accept a public brand website, understand
the brand, and return a beautiful vertical reel with a licensed human presenter
and supporting brand/product visuals.

## What Changes

- Add one public, anonymous URL-submission page.
- Fetch the submitted HTTPS website safely and extract cited brand facts,
  colors, logo/product imagery, and usable page captures.
- Turn the evidence into a concise script and vertical storyboard.
- Render with a commercially licensed, model-released human presenter plus
  website-derived and generated supporting visuals.
- Expose job status, an inline preview, byte-range streaming, and MP4 download.
- Remove the obsolete customer auth, workspace, credit, billing, actor
  marketplace, payout, and social-publishing product paths.

## Capability

- `anonymous-brand-reel`: anonymous website intake, evidence-backed creative
  generation, licensed presenter composition, render status, preview, and
  download.

## Scope

### In scope

- One submitted public HTTPS website per generation.
- SSRF-safe fetch and bounded extraction.
- Human-presenter licence/provenance validation.
- Script, storyboard, voice, captions, vertical render, preview, and download.
- Reuse of existing renderer adapters, job store, review checks, and artifact
  byte-range support where they fit the lean flow.

### Out of scope

- Authentication, accounts, users, workspaces, or tenant isolation.
- Billing, subscriptions, credits, checkout, or entitlements.
- Actor onboarding, AI twins, biometric uploads, KYC, earnings, or payouts.
- Social connections, posting, scheduling, or a creator marketplace.
- Deploying or changing production configuration in this change.

## Success Criteria

1. A visitor submits a valid public brand URL without signing in.
2. The generated brief cites only facts/assets derived from that website.
3. A completed output is a 9:16 reel with a visible licensed human presenter,
   supporting brand visuals, voice, captions, and provenance.
4. The visitor can preview and download the MP4 from the job page.
5. Unsafe/private URLs, unsupported sites, missing presenter proof, and render
   failures fail clearly without fabricating a successful output.
