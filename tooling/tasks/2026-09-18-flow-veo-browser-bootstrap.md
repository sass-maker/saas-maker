---
status: blocked
started: 2026-09-18
needs: [owner verification of Flow profiles, configured Jules authentication]
issue: https://github.com/sass-maker/saas-maker/issues/249
created: 2026-09-18
skills:
  - saas-maker/tooling/skills/flow-veo-browser
  - saas-maker/tooling/skills/jules-cloud-worker
---

# Bootstrap the three-account Google Ultra workers (Flow + Jules)

Canonical tracking: [SaaS Maker #249](https://github.com/sass-maker/saas-maker/issues/249).
The historical outcome below is retained; the current readiness checkpoint
supersedes its provider-auth diagnosis.

Two skills were built on 2026-09-18 that both depend on **three experimental
Google Ultra accounts** being signed in. They share the same sign-in session —
do both phases in one sitting.

**Read first:**

- `saas-maker/tooling/skills/flow-veo-browser/SKILL.md`
- `saas-maker/tooling/skills/jules-cloud-worker/SKILL.md`

**Requires the owner present.** Sign-in, password, MFA, age verification, and
CAPTCHA are manual by design — never guess or store credentials yourself.

## Phase 1 — Flow/Veo browser profiles

For each account A, B, C:

1. `flow-worker launch A` — opens Chrome with persistent profile
   `state/profiles/FLOW-A` at labs.google/flow. Repeat for B, C.
2. Owner completes sign-in/MFA in each window. **Verify the signed-in email
   is the correct experimental Ultra account — never the owner's normal Pro
   account.** If an account can't get in:
   `flow-worker state X NEEDS_USER --notes "login wall"` and continue.
3. Per-account audit (see SKILL.md §"Account audit"):
   - Read remaining Flow credits + refresh date from the profile UI →
     `flow-worker balance set X <n> --starting <n> --refresh-date <d>`
   - Confirm which Nano/Veo models that account actually offers (promotional
     accounts differ) and the live per-generation costs →
     `flow-worker model cost <name> <n>`
   - Create or reuse a `Flow Automation` project in each account.
4. `flow-worker report` — expect 3× READY with real balances.
5. Optional smoke test, **only with explicit owner approval** (it spends
   credits): one cheap Nano Banana or Veo Lite generation end-to-end —
   `route --cost`, `precheck`, Generate, `debit`, `job add`, download,
   `job done`. Proves the loop works.

## Phase 2 — Jules API keys (same sign-in session)

Each of the three Google accounts gets a Jules API key (**Jules → Settings**,
max 3 keys per account).

1. In each signed-in session, open jules.google.com, create one API key.
2. Store keys in `saas-maker/tooling/skills/jules-cloud-worker/state/.env.local`:

   ```
   JULES_API_KEY_A=...
   JULES_API_KEY_B=...
   JULES_API_KEY_C=...
   ```

   (or as `op://` / `keychain:` refs per SKILL.md "Secrets"). Never commit.
3. GitHub repo access may need one-time authorization inside Jules per
   account — do it while the owner is present.
4. `jules-worker setup` — expect all three accounts authenticated and a repo
   access matrix. Repos showing `-` need that account's GitHub connection
   fixed in Jules, then `jules-worker sources --refresh`.

## Constraints (both phases)

- Flow generations consume **subscription credits only** — never buy credits,
  never upgrade, never fall back to Vertex/Gemini/paid APIs.
- No prompt rewriting to dodge safety rejections; record and move on.
- Jules quota is locally tracked only (no API endpoint exists); don't trust
  the estimate over an actual quota error.

## Definition of done

- `flow-worker report` shows A/B/C `READY` with real balances and a batch
  budget ready to set.
- `jules-worker usage` shows all three accounts `READY`; `sources` matrix
  covers the target repos.
- Manifest/ledger plumbing verified (phase-1 smoke test or a dry
  `job add`/`done` cycle).
- Report outcome here + set `status: done`.

## Outcome

Re-attempted with the owner present on 2026-09-19 using the regular Chrome
profile. Accounts A/B/C were verified as Google Pro accounts with 1,050 Flow
credits each, a `Flow Automation` project was created in each account, and the
local ledger completed a zero-credit dry lifecycle. No generation credits were
spent.

One Jules key per account was created and stored in the Fleet Infisical project
under `dev/jules`; no key was written to the repository. `jules-worker setup`
reached the documented `GET /v1alpha/sources` endpoint but all three new-format
Google authorization keys returned HTTP 401. An independent check with Google's
official Jules CLI reproduced the provider-side auth failure: OAuth login
succeeded, but the CLI's `aida` token was rejected by the Jules API for
insufficient scope. The worker therefore remains `AUTH_FAILED` for A/B/C and
this task stays blocked until Google accepts its currently issued Jules keys or
ships a working OAuth scope. The owner should rotate the key exposed during
interactive setup before it is used again.

The API blocker was bypassed with Jules' supported GitHub Issues integration.
The Google Labs Jules GitHub App is installed on the `sass-maker` organization
with access limited to `sass-maker/saas-maker`; all three Pro accounts can see
that repository in Jules. Account A is the verified owner of issue-label tasks.
Issue #114 was dispatched by applying the `jules` label, acknowledged by the
`google-labs-jules` bot, and entered remote repository setup in Jules session
`16613944077704222315`. No pull request has been merged.

## Readiness checkpoint — 2026-10-14

Bootstrap readiness remains **blocked** after supported read-only checks. No
generation, project creation, credit spend, credential provisioning/rotation,
or access change was performed.

- Current installed skill aliases resolve to the agent-config checkout, whose
  state has no readiness records. Retained local records belong to this SaaS
  Maker tooling checkout. Invoke its `tooling/skills/flow-veo-browser/bin/flow-worker`
  and `tooling/skills/jules-cloud-worker/bin/jules-worker` explicitly; their short
  command names were not found on the checking process's PATH.
- Flow's retained A/B/C records say `READY`, while all three notes require owner
  sign-in/MFA in fresh profiles. No account-to-label identity mapping is recorded.
  Authenticated Google sessions in the regular browser do not qualify the intended
  isolated experimental profiles. Current balances, entitlements, model availability
  and generation costs remain unknown; recorded balances are not fresh UI evidence.
- The canonical Jules `sources --refresh` command returned exit 0 but made no
  successful provider request: A/B/C remain `NO_KEY`, and repository-access cache
  timestamps remain September 20. Cached sources and process success do not prove
  current authentication or repository access. The historical HTTP 401 was not
  reproduced and is not treated as a current provider failure.

Owner action: verify the intended experimental account mapping and existing
A/B/C profile sessions, completing sign-in/MFA manually if necessary; provide
the existing supported authenticated Jules CLI context, then repeat read-only
source checks. Keep identities, provider output and credentials private. Any
provisioning/access change or credit-consuming smoke requires its own scope.
