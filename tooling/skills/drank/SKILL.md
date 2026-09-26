---
name: drank
description: >
  Look up and track Domain Rating (DR) for any domain, or report DR history for the
  owner's Fleet domains. Uses the public drank endpoint at domains.sassmaker.com —
  no API key, no signup. Use for "what's the DR of X", "rank my domains by DR",
  "did codevetter.com's DR move", or comparing a domain against the fleet board.
---

# DRank — domain rating lookup and tracking

DRank answers one question precisely: **what is this domain's Ahrefs DR, and how is it moving?**

Two surfaces, both public and credential-free:

- **Live lookup** — `GET https://domains.sassmaker.com/api/dr?target=<domain>`
  proxies the Ahrefs free public DR endpoint. Returns JSON. No key needed.
- **Fleet history** — `https://sassmaker.com/ranks.json` is a checked-in snapshot
  of DR history for all owned Fleet domains (weekly refresh via GitHub Action).

## When to use

- "What's the DR of example.com?"
- "Rank all my domains by domain rating"
- "Did posttrainllm.com's DR change this month?"
- "Which fleet domains are below DR 5?"
- Comparing a candidate launch directory's DR against the fleet baseline

## How to invoke

### Live DR lookup

```bash
curl -s "https://domains.sassmaker.com/api/dr?target=codevetter.com"
# → { "domain_rating": <number|null> } — shape may include nested domain_rating object
```

Normalize targets yourself: strip scheme and `www.`, lowercase. The endpoint
rejects anything without a dot.

### Fleet DR snapshot

```bash
curl -s https://sassmaker.com/ranks.json | jq '.domains | keys'
```

Snapshot shape: `{ lastUpdated, domains: { "<domain>": { "history": [{ts, dr}] } } }`.
`ts` is a millisecond epoch; sort descending for latest reading. A missing or
null `dr` means the provider returned no reading — report it as unknown, not 0.

### Ranking the fleet

Fetch the snapshot, take the latest `dr` per domain, sort descending. That's the
public board at `https://sassmaker.com/ranks` rendered as data.

## Honesty rules

- DR is an Ahrefs-derived metric — always attribute it as "Ahrefs DR" or
  "provider-reported DR", never as an objective authority score.
- A null reading means "not reported", not "DR 0".
- The snapshot is a weekly rollup — say "as of <lastUpdated>", not "current".
- Do not run bulk lookups to build a private database; the endpoint is a
  courtesy proxy for occasional lookups.

## Boundaries

- Read-only. No write paths exist.
- No credentials required or accepted.
- The archived drank app source lives at `fleet-archive/drank`; treat it as
  history. This skill only needs the two public endpoints above.
