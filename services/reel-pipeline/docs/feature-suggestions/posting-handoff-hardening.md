# Feature Suggestion: Posting Handoff Hardening

## Why this matters

The repo already keeps autopost gated, which is the correct default. The next
big product improvement is not automatic publishing itself, but a hardened
handoff that makes a ready-to-post reel provably safe to hand to a downstream
poster.

## Proposal

Add a posting handoff package that is only emitted for accepted video variants:

- normalized caption text
- channel-specific aspect and duration checks
- artifact URL and byte-range validation status
- approval history
- explicit posting provider eligibility

The package should be generated only after the video review gate passes.

## User impact

- Safer downstream scheduling.
- Fewer ambiguous “ready” states.
- Clearer separation between review approval and actual posting.

## Suggested scope

- Generate a handoff manifest when a variant becomes `ready_to_post`.
- Add provider eligibility checks without sending anything automatically.
- Surface the manifest in `/review` and the Worker artifact path.
- Add tests that prove rejected videos never enter the handoff package.

## Success criteria

- A reviewer can see exactly what a downstream poster would receive.
- No unaccepted variant can be marked eligible for posting.
- The handoff package is deterministic and auditable.

