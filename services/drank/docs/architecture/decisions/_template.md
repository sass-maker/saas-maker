# ADR template

Copy this file to `00NN-short-slug.md` and fill it in. Keep it short.

```
# ADR-00NN — <short title>

**Date:** YYYY-MM-DD
**Status:** proposed | accepted | superseded by ADR-00MM | deprecated

## Context

What is the problem? What forces are in play (constraints, existing systems,
trade-offs)? One short paragraph.

## Decision

What we decided. One short paragraph or a short list.

## Consequences

What follows from this — positive, negative, neutral. What becomes easier,
what becomes harder, what to watch for.

## Alternatives considered

Name each alternative and why it was rejected. Keep it to one line each.
```

## Numbering

- Zero-padded, monotonically increasing (`0001`, `0002`, ...).
- Never renumber. Supersede with a new ADR that points back.

## When to write an ADR

- A decision that is non-obvious from the code, has a real trade-off, or will
  look wrong to a future reader without the context.
- You do not need an ADR for trivial changes, dependency bumps, or copy edits.
