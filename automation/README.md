# Fleet Automation

This directory holds versioned automation intent and helper scripts. Runtime
credentials, device pairings, and OpenClaw's local cron database remain
machine-local.

No scheduled jobs are enabled by default. A cron should be added only after it
has a delivery surface and a specific benefit. The first useful jobs are:

- a weekday morning brief once calendar and inbox access are explicitly wired;
- a weekly Fleet health report delivered to the operator's chosen phone channel;
- a Wi-Fi alert escalation only when the existing monitor detects a sustained
  outage.

Phone delivery is deliberately a prerequisite for conversational crons. Before
a phone node or explicit messaging channel is paired, scheduled agent output
would only create noise on the host machine.

Use `../scripts/agent-stack.sh pause` to stop the OpenClaw gateway and all of
its scheduled work on a machine. `resume` restores it. These controls and all
shared behavior live in this repository so another machine can use the same
Fleet Ops source of truth without copying credentials.
