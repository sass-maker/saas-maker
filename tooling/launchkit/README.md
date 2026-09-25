# Launchkit

A free, agent-executable launch toolkit built on the launchdesk destination
catalog — the open equivalent of paid "agent does marketing" repo kits.

Give an agent a product brief once. The planner picks a truthful set of
submission routes from the catalog, the agent works each route using its
per-platform playbook, and a tracker records what actually happened —
including the difference between *submitted*, *scheduled*, and *live*.

## Pieces

| Piece | Path | What it does |
|---|---|---|
| Product brief | `brief.template.md` | Fill once per product: facts, approved claims, assets, agent permissions. |
| Run planner | `scripts/plan-run.mjs` | Emits `run-plan.json` of ≤N suitable routes; never pads the target. |
| Run prompt | `prompts/run.prompt.md` | Paste-ready instructions for the executing agent. |
| Tracker | `tracker.template.json` + `tracker.schema.json` | Per-route state ledger with evidence fields. |
| Report | `scripts/report.mjs` | Console summary of tracker state and next actions. |
| Playbooks | `apps/showcase/src/data/launchdesk-playbooks/` | 330 researched per-platform submission guides (schema `fleet.launchdesk-playbook.v1`). |
| Catalog | `apps/showcase/src/data/launchdesk.json` | 1,100+ destinations with provenance-honest metrics. |

## Quickstart

```bash
# 1. Copy and fill the brief for your product
cp tooling/launchkit/brief.template.md brief.md   # edit it

# 2. Plan a run (from the repo root)
node tooling/launchkit/scripts/plan-run.mjs --brief brief.md --n 10 \
  --out run-plan.json

# 3. Copy tracker template, then paste prompts/run.prompt.md into your agent
cp tooling/launchkit/tracker.template.json tracker.json

# 4. After (and during) the run
node tooling/launchkit/scripts/report.mjs --tracker tracker.json
```

## Honest-evidence rules

- Playbook grade `researched` means assembled from cited public pages — not a
  completed submission. `observed` is only written by runs that actually
  happened.
- A saved draft is `prepared`, never `submitted`. A confirmed date is
  `scheduled`, never `live`. `live` requires a resolving public listing URL.
- The planner emits a smaller target when fewer routes honestly fit; it never
  tops up with unknown or paid routes.
- The agent pauses for logins, human-verification challenges, payment, and
  any condition the brief does not approve — and records `blocked` with the
  reason instead of attesting compliance.

Everything here is public and credential-free. Registration, publication,
and human gates stay with the operator unless the brief explicitly delegates
them.
