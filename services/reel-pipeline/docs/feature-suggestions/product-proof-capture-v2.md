# Feature Suggestion: Product Proof Capture v2

## Why this matters

The current product-proof path already captures screenshots and demo recordings,
but it still depends on the renderer choosing the right proof surface for each
idea. The next step is to make proof selection explicit and deterministic so
reviewers do not have to guess whether a reel is actually grounded in product
evidence.

## Proposal

Add a proof-capture planner that resolves the best available proof surface
before render time:

- public product route screenshot
- short browser recording for demo steps
- repo-backed changelog or task evidence
- internal cockpit or queue proof for fleet tools

The planner should return a structured capture manifest with:

- selected proof type
- fallback order
- captured asset paths
- capture failures
- reviewer-facing proof explanation

## User impact

- Faster approval because the first frame already shows the intended proof.
- Fewer generic fallback cards.
- More consistent rendering across products with and without public URLs.

## Suggested scope

- Add a proof selection function that ranks available sources.
- Persist the chosen proof metadata on the reel record.
- Surface proof type and fallback reason in `/review`.
- Add smoke coverage for screenshot, recording, and fallback selection.

## Success criteria

- Every render has an explicit proof type.
- Reviewers can tell why a proof surface was chosen.
- Recording fallback still produces a usable reel when the browser path fails.

