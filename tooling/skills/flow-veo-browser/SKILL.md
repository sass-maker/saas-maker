---
name: flow-veo-browser
description: Drive three experimental Google Ultra accounts in Flow (Nano Banana image generation + Veo video generation) via a browser agent, spending only included subscription Flow credits. Use when asked to generate images/videos with Flow or Veo, audit Flow credit balances, distribute generations across the Ultra accounts, batch creative briefs, or archive generated media. Never substitute paid APIs (Vertex/Gemini) for browser generation.
---

# Flow / Veo Three-Account Browser Agent

Three experimental Google Ultra accounts (FLOW-A, FLOW-B, FLOW-C) generate
images and videos in [Flow](https://labs.google/flow) using their **included
subscription Flow credits**. `scripts/flow.py` (`bin/flow-worker`) owns the
deterministic state — balances, budget, routing, manifest. **You** drive the
browser (terminal-browser, Playwright, Chrome DevTools, or whatever browser
tooling is available).

Pipeline: **brief → Nano Banana exploration → Veo generation → download →
manifest.**

## Non-negotiables

- The point is consuming **subscription Flow allowances**. Never silently
  replace browser generation with Vertex/Gemini/paid API calls.
- The owner's normal **Pro account must never be used** — only FLOW-A/B/C.
- **Never** buy extra credits, upgrade subscriptions, switch to a paid API,
  retry blindly, or spawn extra variants just because a result is slow.
- Do **not** rewrite prompts to circumvent Google's safety controls. A policy
  rejection is recorded, not worked around.
- Flow charges **per generation** and one request can produce multiple
  outputs — output count is part of the cost check.

## Browser sessions

Three persistent, isolated Chrome profiles under `state/profiles/`:

```
flow-worker launch A    # opens Chrome --user-data-dir=state/profiles/FLOW-A
flow-worker launch B
flow-worker launch C
```

First run needs manual sign-in, password, MFA, age verification, CAPTCHA —
that is expected and one-time. Afterward sessions persist. If a session drops
to a login/verification wall, mark it `NEEDS_USER` and continue with the other
accounts:

```
flow-worker state A NEEDS_USER --notes "login wall at 2026-09-18"
```

## Account audit (do this before every batch)

For each account, in its own profile:

1. Open Flow, verify the signed-in email is the right experimental account.
2. Read remaining Flow credits from the profile UI — record refresh date if
   visible (credits refresh each billing cycle).
3. Record it:

   ```
   flow-worker balance set B 9300 --starting 10000 --refresh-date 2026-10-01
   ```

4. Confirm which Nano/Veo models are offered — promotional Ultra accounts do
   **not** all have identical entitlements.
5. Create or reuse a `Flow Automation` project inside that account so work
   stays organized.
6. Read the per-generation credit cost shown in the UI and record it:

   ```
   flow-worker model cost veo-3.1-quality 100
   ```

Reference costs (subject to change — **live UI always wins**):

```
Veo 3.1 Lite     ~5 credits     Veo 3.1 Fast    ~10 credits
Veo 3.1 Quality ~100 credits
```

`flow-worker balance show` prints the ledger.

## Routing

For each new **independent** generation:

```
flow-worker route --cost 100
# → route → B (balance 9300, post-cost 9200)
```

Eligibility: `state=READY` ∧ balance ≥ cost ∧ batch budget room → pick the
**highest balance** (balances consumption across the three accounts).

A **variation of an existing scene** should stay in the same Flow
project/account so context and references stay organized — pass `--prefer`:

```
flow-worker route --cost 10 --prefer B
```

## Pre-Generate checklist

Before clicking Generate, **every time**:

```
flow-worker precheck --account B --project product-launch \
  --model veo-3.1-quality --cost 100 --outputs 2 --refs
```

Verify in the browser yourself: correct signed-in account, correct project,
correct model, correct output count, references attached, expected credit
cost, within batch budget. `precheck` blocks on ledger problems; the UI state
is your job to confirm.

After Generate is confirmed submitted:

```
flow-worker debit B 100 --job launch-023
flow-worker job add --project product-launch --job-id launch-023 \
  --account B --type video --model "Veo 3.1 Quality" \
  --prompt "cinematic reveal" --refs hero.png --credits 100
```

## Input format

Briefs arrive as YAML:

```yaml
project: product-launch
videos: 12
model: veo-3.1-quality
duration: 8s
references: [product.png, style.png]
brief: A premium cinematic reveal...
variants:
  camera: [dolly-in, static, orbital]
archive: true
# optional:
first_frame: ...
last_frame: ...
aspect_ratio: "16:9"
dialogue: ...
negative_constraints: ...
max_total_credits: 3000
```

`max_total_credits` maps to the batch budget:

```
flow-worker budget set 3000
```

Routing/debit refuse anything that would exceed it. **Stop at the budget.**

## Generation strategy

Escalate cost only as the brief earns it:

```
Nano Banana image exploration      (cheap composition search)
        ↓ approve promising frames
Veo Fast motion experiments        (cheap motion check)
        ↓ pick the candidate
Veo Quality final renders
```

Respect an explicitly requested model — the ladder is the default when the
user leaves it open, not an override.

Keep multiple generations in flight. For a Quality batch:

```
submit on A → submit on B → submit on C → poll all → submit next
```

Do not sit synchronously on one render.

## Failure handling

- **Looks stuck** → refresh the project, inspect assets, check whether it
  actually completed. Retry **only** on clear failure — a duplicate click is
  a duplicate charge.
- **Generation failed / credit refund shown** → record `job fail`, re-route.
- **Account hits a limit** → `flow-worker state A EXHAUSTED`; subsequent
  independent jobs route to B/C.
- **Login / verification wall** → `state NEEDS_USER`; continue elsewhere,
  tell the user once.
- **Safety/policy rejection** → `job fail --reason "policy rejection"` and
  move on. Never auto-rewrite around it.
- **Paid-upsell prompt** → decline. Never buy credits or switch APIs.

## Output storage + manifest

```
flow-worker init product-launch
```

```
$FLOW_MEDIA_ROOT/product-launch/     (default ~/Google-AI-Experiments)
├── images/
├── videos/
└── manifest.jsonl
```

Download completed media promptly (Flow assets can age out). Then:

```
flow-worker job done --project product-launch --job-id launch-023 \
  --file videos/launch-023.mp4
```

Every manifest record carries full provenance:

```json
{"jobId": "launch-023", "account": "B", "type": "video",
 "model": "Veo 3.1 Quality", "prompt": "...", "references": ["hero.png"],
 "credits": 100, "submittedAt": "...", "completedAt": "...",
 "file": "videos/launch-023.mp4", "status": "DONE"}
```

Optional archive stage (only when `archive: true`): upload final assets to
**one chosen** experimental account's Drive under `AI Generated Media/` —
Drive is archive storage, not the orchestrator.

## Commands

```
flow-worker init <project>                    # scaffold media dirs + manifest
flow-worker launch A|B|C [--url ...] [--print]
flow-worker balance set <A> <n> [--starting n] [--refresh-date d]
flow-worker balance show
flow-worker state <A> READY|EXHAUSTED|NEEDS_USER [--notes ...]
flow-worker route --cost <n> [--prefer <A>]
flow-worker precheck --account <A> --project <p> --model <m> \
                    --cost <n> [--outputs n] [--refs]
flow-worker debit <A> <n> [--job <id>]
flow-worker budget set <n> | budget show
flow-worker model | model cost <name> <n>
flow-worker job add|done|fail|status ...
flow-worker jobs --project <p> [--status DONE]
flow-worker report
```

## Intents you should understand

- **audit accounts** → launch each profile, verify identity, record balances +
  model availability, report a per-account table.
- **show Flow usage** → `balance show` + `report`.
- **generate image batch** → Nano Banana per brief, routed, manifest-tracked.
- **generate video batch** → the full pipeline above.
- **continue project** → read manifest, resume unfinished `SUBMITTED` jobs
  (check Flow first — they may already be done), then the remaining briefs.
- **download completed outputs** → pull DONE-pending files, update manifest.
- **archive project** → Drive upload of final assets, one account.

Example:

> Generate 30 Veo Quality product clips from these 10 briefs. Three camera
> variants each, spread across all three accounts, never exceed 3,000 Flow
> credits, download everything.

→ `init`, `budget set 3000`, audit all three accounts, then loop:
`route --cost 100` → precheck → Generate in that profile → `debit` +
`job add` → keep three renders in flight → download → `job done` →
`report` when done or budget spent.

## Files

```
flow-veo-browser/
├── SKILL.md                # this file
├── config.example.yaml
├── bin/flow-worker         # CLI shim → scripts/flow.py
├── scripts/flow.py         # stdlib-only ledger/routing/manifest
└── state/                  # ledger.json, profiles/FLOW-{A,B,C} (gitignored)
```
