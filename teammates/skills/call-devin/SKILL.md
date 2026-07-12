---
name: call-devin
description: Optional proprietary Devin teammate. Use only when the user explicitly asks for Devin or approves the spend/lock-in tradeoff.
---

# Call Devin

Devin is a proprietary agent platform. It is allowed as an optional Fleet
teammate only when the user explicitly asks for it or confirms the spend and
vendor-lock-in tradeoff. Prefer Codex, Grok, or Hermes when they can do the job.

## Current Local State

No Devin CLI is currently detected on this machine. Do not invent credentials or
add secrets to the repo. If Devin is configured later, keep credentials
machine-local and record only non-secret status in Fleet Ops.

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

If no Devin CLI/app integration is available, report that status and fall back
to Codex, Grok, or Hermes.
