---
name: launchkit
description: >
  Plan and run an honest directory-submission launch campaign for a product
  using the launchdesk catalog: fill one product brief, generate a truthful
  run plan of free/conditional routes, execute each route from its
  per-platform playbook with human gates, and record submitted/scheduled/live
  states with evidence in a tracker. Use for "launch my product", "submit to
  directories", "plan a launch run", "directory submissions", or /launchkit.
---

# launchkit — brief once, plan truthfully, submit with evidence

The kit lives at `tooling/launchkit/`. Data lives in the launchdesk catalog
(`apps/showcase/src/data/launchdesk.json`, 1,100+ destinations) and the
per-platform playbooks (`apps/showcase/src/data/launchdesk-playbooks/`).

## Flow

1. **Brief** — copy `tooling/launchkit/brief.template.md`, fill identity,
   assets, approved/forbidden claims, and agent permissions. Permissions are
   binding: account creation, publication, badge placement, spend.
2. **Plan** — `node tooling/launchkit/scripts/plan-run.mjs --brief brief.md
   --n 10 --out run-plan.json`. The planner keeps a smaller truthful target
   when fewer routes qualify; it never pads with paid or unknown routes.
3. **Run** — hand the agent `tooling/launchkit/prompts/run.prompt.md` plus
   the run plan and a copy of `tracker.template.json`. Work routes in rank
   order; obey each playbook's conditions and watch-fors.
4. **Track** — every route carries a state in the tracker:
   `planned → prepared → submitted → scheduled → live`, or `rejected` /
   `blocked` / `skipped`. Drafts are `prepared`, not submitted; confirmed
   dates are `scheduled`, not live; `live` needs a resolving public URL in
   `evidence`.
5. **Report** — `node tooling/launchkit/scripts/report.mjs --tracker
   tracker.json` prints state counts, next actions, and any states recorded
   without evidence.

## Non-negotiables

- Grade `researched` playbooks are assembled from cited public pages — treat
  them as a starting map and re-check the live site; record drift in notes.
- Stop for the human on logins, CAPTCHAs, ID/workplace verification,
  payments, and any condition the brief didn't approve. `blocked` with a
  reason beats a fabricated attestation.
- Never invent claims, testimonials, or identities; never solicit votes;
  never post as the founder where a platform requires a human voice.
