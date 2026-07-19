---
title: Failed approach — Node 24 with Lighthouse 12
description: Node 24 breaks Lighthouse 12 via an internal TraceEngineResult performance mark; do not re-attempt without an upstream fix.
---

# Failed approach: Node 24 with Lighthouse 12

**Tried:** running the CLI on Node 24.
**Result:** every Lighthouse audit fails before it starts.
**Do not re-attempt** without an upstream Lighthouse fix.

## What breaks

Lighthouse 12, called programmatically as a Node module, throws on an
internal `TraceEngineResult` performance mark under Node 24. The failure is
immediate and total — not a metric skew, a hard crash on every audit.

## Why it can't be patched locally

The mark is internal to Lighthouse's trace engine. We don't own that code,
and the call site (`cli/src/runner.ts`) passes a standard inline config
(`{ port, logLevel: 'silent', output: 'json' }` + `onlyCategories:
['performance']`); there's no flag that avoids the trace-engine path while
still producing performance metrics.

## What we did instead

Hard-pinned `engines: { node: ">=20 <24" }` in both `package.json` (root)
and `cli/package.json`, with a comment pointing at this issue. The supported
path is Node 22 LTS. See
[ADR: Node 22 LTS pin](../../architecture/decisions/node-22-lighthouse-12-pin.md).

## When to revisit

When Lighthouse 13 ships (or 12.x is patched for Node 24), bump the
`engines` ceiling in both `package.json` files, re-run `pnpm install` so the
`better-sqlite3` native binding rebuilds against the new Node, and run a
smoke swarm to confirm. Until then, Node 24 is a known dead end.
