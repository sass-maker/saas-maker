# Feature Suggestion: Review Queue Automation

## Why this matters

Reel review is already gated correctly, but the operator still has to inspect
ideas and renders manually in a single queue. The next useful product step is to
turn the review surface into a real workflow queue with prioritization, batch
actions, and traceable handoff back to SaaS Maker.

## Proposal

Add review queue automation on top of the existing accepted/rejected state:

- queue ordering by proof strength, project priority, and stale age
- batch accept or reject for related variants
- auto-link to SaaS Maker task or changelog records
- notes on why a reel was deprioritized
- a clear separation between idea review and video review

## User impact

- Less time spent hunting for the next best reel to review.
- Easier cleanup of variant floods when a good idea renders many outputs.
- Better traceability between the fleet backlog and reel decisions.

## Suggested scope

- Add queue metadata to reel records.
- Compute a review priority score from proof strength and current status.
- Expose the priority in `/review` and list APIs.
- Add a small command or API for batch decisions.
- Add a sync note back to SaaS Maker when a reel changes state.

## Success criteria

- Operators can sort by priority instead of newest-first.
- Batch decisions reduce repetitive clicking on obvious variants.
- SaaS Maker stays the source of truth for task linkage.

