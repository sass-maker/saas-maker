---
name: call-devin
description: Optional proprietary Devin teammate. Use only when the user explicitly asks for Devin or approves the spend/lock-in tradeoff.
---

# Call Devin

Devin is a proprietary agent platform. It is allowed as an optional Fleet
teammate only when the user explicitly asks for it or confirms the spend and
vendor-lock-in tradeoff. Prefer Codex, Grok, or Hermes when they can do the job.

## Current Local State

The local `devin` CLI is installed and logged in to Sarthak's Devin Pro account.
Prefer the CLI for teammate calls. Smoke test on 2026-07-12:
`devin -p "Reply with exactly: DEVIN_OK" --permission-mode auto` returned
`DEVIN_OK`.

Fleet Ops also includes `scripts/agent-bin/devin-session.mjs`, a narrow adapter
for the official Devin v3 REST API. The adapter is optional and still needs a
least-privilege service-user token and organization ID in `DEVIN_API_KEY` and
`DEVIN_ORG_ID`. Keep both machine-local. The adapter refuses session creation
unless the invoking process also sets `DEVIN_ALLOW_SPEND=yes`.

```sh
devin -p "GOAL: ... SCOPE: ... CONSTRAINTS: ... VERIFY: ... RETURN: ..." \
  --permission-mode auto

./fleet-ops/scripts/agent-bin/devin-session.mjs status
DEVIN_ALLOW_SPEND=yes ./fleet-ops/scripts/agent-bin/devin-session.mjs create \
  --title "Bounded Fleet task" \
  "GOAL: ... SCOPE: ... CONSTRAINTS: ... VERIFY: ... RETURN: ..."
```

## Guardrails

- Confirm the task is worth ACU/spend before invoking.
- Do not send secrets, env files, private keys, or production credentials.
- Use an isolated branch/workspace and a narrow brief.
- Treat Devin output as a draft: inspect the diff and rerun checks locally.
- Log outcomes in `fleet-ops/teammates/SCORECARD.md`.

## Brief

Use the same shape as other teammates:

```text
GOAL:
SCOPE:
CONSTRAINTS:
VERIFY:
RETURN:
```

If Devin credentials are unavailable or spend is not approved, report that
status and fall back to Codex, Grok, or Hermes.
