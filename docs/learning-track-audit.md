# Fleet learning-track audit

Canonical audit of the `docs/learning/new-things.md` study-queue standard (see
root `CLAUDE.md` → "Learning tracks for fancy-tech projects") across the fleet.

**Rule recap:** fancy-tech projects (ML/AI internals, novel runtimes, systems,
exotic frameworks) keep a short `docs/learning/new-things.md` study queue. Each
entry: `What` / `Why here: TBD` (the **user** fills this after learning — agents
never invent it) / `Gotcha (from code)` / `Source`. Plain full-stack CRUD
(standard Next/Vite + Drizzle/Turso + standard auth) is **exempt**.

_Last audited: 2026-06-23._

## Coverage

| State | Projects |
|---|---|
| **Has study queue** (16) | ai-game (25 topics), high-signal (14), codevetter (13), reel-pipeline (13), email-manager · reader · saas-maker · swe-interview-prep (12), pace (11), open-historia · starboard (10), free-ai · research-papers · taste (9), looptv (7), tinygpt (14, migrated 2026-06-23) |
| **Old scaffold — migrated/retired** | tinygpt → `new-things.md` (old `lessons.md` archived); truehire → exempt, `decisions.md` archived |
| **Exempt (plain full-stack)** | anime-list, drank, everythingrated, significanthobbies, today-little-log, rolepatch, materia, forecast-lab, truehire |
| **Fancy but no track — candidates** | karte (agent-trust/AI chat), knowledge-base (RAG), verified-bases (payments/Go) |

## Verdict

**Scaffolding is stocked; the learning is unfilled.** Across *every* populated
project the `Why here:` field is ~100% `TBD` (ai-game 26 TBD, high-signal 14,
email-manager 12, …). That's by-design — `Why here` is the user's to fill — so
the agent-side job (stub topics) is done, but no queue has been worked through
yet. Populating the `Why here:` lines as the user learns each topic is the
outstanding, human-side work; it is NOT something an agent should fabricate.

## Agent-side gaps (fixable without inventing understanding)

1. ~~**Migrate old scaffolds**~~ — DONE 2026-06-23: tinygpt migrated to
   `docs/learning/new-things.md` (14 topic stubs, all `Why here: TBD`); old
   `lessons.md` archived. truehire judged plain full-stack (exempt); its
   `decisions.md` was retired to `docs/archive/`.
2. **This audit doc** — previously referenced by the standard but missing; now
   created here.
3. **Candidate new tracks** — karte, knowledge-base, verified-bases use
   non-trivial tech but have no track. Per the standard, creating one is a
   structural addition to **confirm with the user first** before scaffolding.

## Shape reminders (when touching these files)

- Keep `new-things.md` a queue, not an essay — 3–5 lines per topic.
- Lean on external sources; don't re-explain what a paper/framework doc covers.
- Real content only — `TBD` for unknown rationale, never invented.
- Older verbose `docs/decisions.md` / `docs/lessons.md` → `docs/archive/`,
  topics distilled into stubs.
