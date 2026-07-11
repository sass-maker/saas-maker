# Fleet Automation

This directory holds versioned automation intent and helper scripts. Runtime
credentials, device pairings, and local run logs remain machine-local.

## Active cron jobs

`codex-cron/` is the versioned replacement for the Codex app schedules. It keeps
the schedule registry, prompts, runner, installer, and static dashboard in git.
Install or refresh the local crontab with:

```sh
../scripts/agent-bin/install-codex-cron
```

Render the dashboard with:

```sh
../scripts/agent-bin/render-codex-cron-ui
```

## Future channels

New conversational crons should be added only after they have a delivery surface
and a specific benefit. The first useful additions are:

- a weekday morning brief once calendar and inbox access are explicitly wired;
- a weekly Fleet health report delivered to the operator's chosen phone channel;
- a Wi-Fi alert escalation only when the existing monitor detects a sustained
  outage.

Phone delivery is deliberately a prerequisite for conversational crons. Before
a phone node or explicit messaging channel is paired, scheduled agent output
would only create noise on the host machine.

Use `../scripts/agent-stack.sh pause` to stop the OpenClaw gateway and remove
the managed Fleet Ops crontab block on a machine. `resume` restores both. These
controls and all shared behavior live in this repository so another machine can
use the same Fleet Ops source of truth without copying credentials.
