---
status: blocked
started: 2026-09-18
needs: [browser automation, human present for Google sign-in/MFA]
created: 2026-09-18
skills:
  - saas-maker/tooling/skills/flow-veo-browser
  - saas-maker/tooling/skills/jules-cloud-worker
---

# Bootstrap the three-account Google Ultra workers (Flow + Jules)

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

Skipped at the owner's direction on 2026-09-18 because all three Flow profiles
require manual Google sign-in/MFA and Jules setup requires creating API keys.
The profiles were opened once and recorded as `NEEDS_USER`; no credits were
spent, no key was created, and no GitHub authorization was changed.
