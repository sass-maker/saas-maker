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

## Mobile channels

Hermes Telegram is the primary delivery surface for mobile operator pings and
cron results. OpenClaw Telegram is the support-agent and control-plane chat
surface. They must use different Telegram bot tokens.

Configure both with:

```sh
../scripts/agent-bin/mobile-control needs
../scripts/agent-bin/mobile-control configure-telegram
../scripts/agent-bin/mobile-control ping
```

New conversational crons should still be added only after they have a specific
benefit. The first useful additions are:

- a weekday morning brief once calendar and inbox access are explicitly wired;
- a weekly Fleet health report delivered to the operator's chosen phone channel;
- a Wi-Fi alert escalation only when the existing monitor detects a sustained
  outage.

Phone delivery is a prerequisite for conversational crons. Before Telegram is
configured and paired, scheduled agent output should remain local.

Tailscale SSH is the durable private terminal path. `tmate` is a deprecated,
explicit emergency fallback only; its session links are credentials.

Use `../scripts/agent-stack.sh pause` to stop OpenClaw, Hermes, the console, and
the managed Fleet Ops crontab block on a machine. `resume` restores them. These
controls and all shared behavior live in this repository so another machine can
use the same Fleet Ops source of truth without copying credentials.
