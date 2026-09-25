# Launchkit run prompt

Paste this into your agent with paths adjusted. Pair it with a goal-tracking
command (e.g. `/goal`) if your agent supports one.

---

You are running a directory-submission campaign for the product described in
`<path-to>/brief.md`. Read the brief first — its permissions are binding.

**Materials**
- Run plan: `<path-to>/run-plan.json` (routes ranked by suitability)
- Playbooks: `apps/showcase/src/data/launchdesk-playbooks/<domain>.json`
- Tracker: `<path-to>/tracker.json` (schema `fleet.launchkit-tracker.v1`)

**For each route in the plan, in rank order:**

1. Open the route's playbook. Read `requirements`, `conditions`, `workflow`,
   `watchFor`, and `countsAsLive` before doing anything.
2. Check the brief's permissions. If the route needs something the brief does
   not approve (a badge placement, a paid step, an unapproved claim), record
   the entry as `blocked` with the reason in `notes` and move on — do not
   attest compliance you don't have.
3. Prepare the submission from brief facts and approved claims only. Never
   invent testimonials, metrics, or founder identities.
4. Pause for the human on: logins/signups, CAPTCHAs and human-verification
   challenges, ID or workplace verification, payment prompts, and any terms
   the brief forbids. Record `blocked` and continue to the next route — later
   sessions resume the remaining work.
5. Record every state transition in the tracker with `evidence` and `updated`:
   - `prepared` — assets/copy drafted; nothing sent. A saved draft is at most
     `prepared`.
   - `submitted` — the platform acknowledged intake (confirmation screen,
     email, review queue notice). Record the reference in `evidence`.
   - `scheduled` — the platform confirmed a future date/slot. Record it.
   - `live` — only after the public listing URL resolves in a logged-out
     browser. Record the URL in `evidence`.
   - `rejected` / `blocked` / `skipped` — with the reason in `notes`.

**Rules**
- One account per product; search the platform for an existing listing first
  and update rather than duplicate.
- Do not solicit votes, do not post as the founder where platforms require a
  human voice (e.g. Hacker News), do not pay anything unless the brief says so.
- If a playbook's claims conflict with what the live site shows, trust the
  live site, note the drift in the tracker `notes`, and continue.
- When the plan is exhausted, print the tracker summary and stop.
