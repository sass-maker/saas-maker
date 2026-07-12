---
name: call-devin
description: Optional proprietary Devin teammate. Use only when the user explicitly asks for Devin or approves the spend/lock-in tradeoff.
---

# Call Devin

Devin is a proprietary agent platform. It is allowed as an optional Fleet
teammate only when the user explicitly asks for it or confirms the spend and
vendor-lock-in tradeoff. Prefer Codex, Grok, or Hermes when they can do the job.

## Current Local State

Fleet Ops includes `scripts/agent-bin/devin-session.mjs`, a narrow adapter for
the official Devin v3 REST API. It needs a least-privilege service-user token
and organization ID in `DEVIN_API_KEY` and `DEVIN_ORG_ID`. Keep both
machine-local. The adapter refuses session creation unless the invoking process
also sets `DEVIN_ALLOW_SPEND=yes`.

```sh
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
