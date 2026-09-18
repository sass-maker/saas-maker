---
name: jules-cloud-worker
description: Use a pool of three Google Ultra Jules API accounts as asynchronous coding workers, primarily for high-value test generation across repos. Use when asked to run a Jules test-sweep, dispatch bounded tasks to Jules, poll Jules sessions, review Jules PRs, or check Jules account usage/quota. Jules is a batch worker, never the primary interactive agent and never an auto-merger.
---

# Jules Cloud Worker

Three experimental Google Ultra accounts (A, B, C) act as a pool of asynchronous
[Jules](https://jules.google) workers. `scripts/jules.py` (`bin/jules-worker`) is
the CLI; this file is the operating manual.

Pipeline: **inspect repo → identify bounded work → choose account → submit →
monitor → retrieve PR → review → report only worthwhile output.**

## Non-negotiables

- Jules is **not** the primary interactive coding agent. It does bounded,
  well-specified batch work — initially high-value missing tests.
- Do not ask Jules to make architectural decisions.
- Do not optimize for task count or coverage %. **Zero tasks is a valid result.**
- **Never merge a Jules PR automatically.** Every change is reviewed first.
- Do not send identical work to multiple accounts unless explicitly A/B testing.
- A session is **pinned to the account that created it.** Never continue a
  session through another account's key.

## Secrets

One Jules API key per account, created in **Jules → Settings** (max 3 per
account). Sent as `x-goog-api-key: <key>`. **Never commit keys.**

Resolution order for `JULES_API_KEY_{A,B,C}`:

1. Process environment.
2. First `.env.local` of: `$JULES_ENV_FILE`, `state/.env.local`, skill root, cwd.

Values may be literal keys or indirect references:

- `op://vault/item/field` — resolved via `op read` (1Password CLI)
- `keychain:<service>` or `keychain:<service>:<account>` — resolved via
  `security find-generic-password -w`

State lives in `state/jules.sqlite` (gitignored). Override with `JULES_DB`.

## Commands

```
jules-worker setup                    # verify keys, fetch sources, init DB, reconcile
jules-worker usage                    # tracked usage vs plan limits
jules-worker sources [--refresh]      # repo access matrix per account
jules-worker audit <repo-path>        # mechanical repo brief (framework, tests, todos)
jules-worker dispatch <task.yaml> [--sweep N] [--force]
jules-worker test-sweep <path>        # create sweep + audit every repo under path
jules-worker poll                     # reconcile sessions, harvest PRs
jules-worker review                   # list completed work awaiting review
jules-worker review --session <id> --set ACCEPT|REPAIR_ONCE|REJECT|HUMAN_REVIEW \
                   [--repair '<instructions>'] [--notes '...']
jules-worker approve <session-id>     # approve a pending plan
jules-worker message <session-id> <text>
jules-worker status                   # overview
```

## Bootstrap

`jules-worker setup` checks all three keys, calls `GET /v1alpha/sources` per
account, records which GitHub repos each account can reach, warns on
asymmetry, creates the SQLite DB, and reconciles existing remote sessions:

```
Account A: authenticated ✓
Account B: authenticated ✓
Account C: authenticated ✓

Repositories:
CodeVetter        A B C
PostTrainLLM      A B C
foo               A - C
```

GitHub authorization itself may require one-time browser setup in Jules. If a
repo shows `-` for an account, that account can't be routed work for it.

## Usage accounting — read this carefully

Ultra plan limits (not API-returned): **300 new tasks / rolling 24h / account**
and **60 concurrent tasks / account**.

**The documented Jules API has no "remaining quota" endpoint. Do not invent
one.** The local ledger counts only sessions created by this skill:

```
tracked_remaining = 300 - (sessions this skill created in last 24h)
```

`jules-worker usage` prints:

```
ACCOUNT   CREATED/24H   TRACKED LEFT   ACTIVE   STATE
A         19            281            3        READY
```

and always discloses: *Authoritative quota remaining is unavailable via the
documented API — tasks created manually elsewhere make this estimate too high.*
When the API returns a quota error, the account is marked `QUOTA_EXHAUSTED` and
skipped until the tracked window drains, at which point it recovers to `READY`.

## Account routing

For each dispatch:

```
eligible = has key
         ∧ state ∈ {READY}
         ∧ repo present in that account's sources
         ∧ active tasks < 60
         ∧ tracked remaining > 0
pick     = min(active task count), tie-break max(tracked remaining)
```

If dispatch hits a quota error, the account is marked exhausted and routing
retries the next eligible account. Sessions stay pinned to their creator.

## Task specs — never send "add more tests"

`dispatch` takes a YAML (or JSON) spec:

```yaml
repo: sarthak/codevetter            # required, owner/name
branch: main                        # optional; defaults to the source's default branch
title: Regression test for malformed diff header
reason: >-
  malformed headers can silently corrupt parser state.
scope:
  - src/parser/diff.ts
  - tests/parser/
behaviors:
  - malformed header
  - truncated hunk
  - missing filename
acceptance:
  - tests exercise externally observable behavior
  - relevant suite passes
  - no unrelated production changes
  - no weakened assertions
commands:
  - pnpm test parser
forbidden:
  - public API changes
  - broad refactoring
  - unrelated formatting
require_plan_approval: false        # set true for riskier tasks
automation_mode: AUTO_CREATE_PR     # omit/unset for no auto-PR
```

The spec is rendered into a deterministic prompt; weak specs produce weak work.

## test-sweep protocol

```
jules-worker test-sweep ~/projects
```

1. The command discovers git repos under the path, opens a sweep id, and
   prints an `audit` brief per repo (framework, test files, recent commits,
   TODOs, which accounts can reach it).
2. **You** read each repo first-hand — purpose, important production paths,
   existing tests, recent changes, known regressions — the audit is a
   starting point, not a substitute.
3. Identify **0–3 high-value missing tests** per repo:

   ```
   critical user behavior
   > previously fixed bugs
   > parsers / transformations
   > state transitions
   > integrations
   > failure handling
   > recent changes
   > generic coverage        (last resort — often skip)
   ```

4. Write one task spec per chosen test, then
   `jules-worker dispatch spec.yaml --sweep <id>`.

### Guardrails (enforced by `dispatch`)

- max **3** new tasks per repo per sweep
- max **20** outstanding unreviewed Jules PRs globally — the review backlog is
  the scarce resource, not Jules capacity
- max **1** active task per subsystem (first scope path component) per repo
- fingerprint dedupe: a near-identical task dispatched in the last 14 days is
  refused (all overridable with `--force` — don't)

## Monitoring

`jules-worker poll` reconciles local state with `GET /v1alpha/sessions` on each
account, extracts `outputs[].pullRequest.url` for finished work, pulls a summary
from the last agent message/progress activity, and flags
`AWAITING_PLAN_APPROVAL` sessions needing `approve` or rejection.

Session states: `QUEUED → PLANNING → IN_PROGRESS → COMPLETED|FAILED`, with
`AWAITING_PLAN_APPROVAL` / `AWAITING_USER_FEEDBACK` / `PAUSED` as interrupt
states. An `AWAITING_USER_FEEDBACK` session is a question — answer it via
`jules-worker message <id> <text>` or kill the task.

## Review rubric — every finished change is independently reviewed

Review the actual PR diff on GitHub, not Jules' summary. Reject if it:

- tests implementation details rather than observable behavior
- duplicates existing tests
- weakens assertions or adds try/catch that swallows failures
- creates flaky, time- or ordering-sensitive tests
- changes unrelated code or production code unnecessarily
- mocks so aggressively the test proves nothing
- passes for the wrong reason

Verdicts:

- `ACCEPT` — worth a human look; still never auto-merged
- `REPAIR_ONCE` — send targeted repair instructions via `--repair`; **one**
  repair cycle max, then escalate
- `REJECT` — close it; record why in `--notes`
- `HUMAN_REVIEW` — ambiguous or touching sensitive paths; escalate

Report only worthwhile output to the user — a short list of accepted PRs with
one-line value notes. Do not narrate the whole queue.

## API reference (as implemented)

| Call | Use |
| --- | --- |
| `GET /v1alpha/sources` | per-account repo access (`sources/github/{owner}/{repo}`) |
| `GET /v1alpha/sessions` | reconcile + quota cross-check |
| `POST /v1alpha/sessions` | create (`prompt`, `sourceContext{source,githubRepoContext{startingBranch}}`, `requirePlanApproval`, `automationMode`) |
| `GET /v1alpha/sessions/{id}` | state, `outputs[].pullRequest` |
| `GET /v1alpha/sessions/{id}/activities` | plan, progress, agent messages, artifacts |
| `POST /v1alpha/sessions/{id}:approvePlan` | approve pending plan |
| `POST /v1alpha/sessions/{id}:sendMessage` | `{prompt}` — feedback/repairs |

Auth: `x-goog-api-key` header on every call. Pagination: `pageSize` +
`nextPageToken`. Quota errors surface as 429 / RESOURCE_EXHAUSTED.

## Failure modes

- **No key / auth failed** — account state `NO_KEY`/`AUTH_FAILED`; fix the key
  and re-run `setup`.
- **Repo not in sources** — connect the repo to Jules for that account
  (browser, one-time), then `sources --refresh`.
- **Quota exceeded** — account marked `QUOTA_EXHAUSTED`; auto-recovers when the
  tracked 24h window drains.
- **Session FAILED** — read activities for `sessionFailed.reason`; usually a
  bad spec, missing toolchain, or flaky env. Fix the spec, not the retry.
- **Stuck session** — `PAUSED`/`AWAITING_USER_FEEDBACK` needs a message;
  long-queued sessions may indicate a silently saturated account.

## Files

```
jules-cloud-worker/
├── SKILL.md                 # this file
├── config.example.yaml      # copy to state/config.yaml (optional)
├── bin/jules-worker         # CLI shim → scripts/jules.py
├── scripts/jules.py         # stdlib-only implementation
└── state/                   # runtime: jules.sqlite, .env.local, config.yaml (gitignored)
```
