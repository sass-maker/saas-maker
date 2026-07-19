# Fleet Automation

This directory holds versioned automation intent and helper scripts. Runtime
credentials, device pairings, and local run logs remain machine-local.

The shared attention, evidence, and action contract is documented in
[`../docs/fleet-automation-control-plane.md`](../docs/fleet-automation-control-plane.md).

## Active cron jobs

The deterministic `nightly-learning-sync` job runs at 02:15 local time. It
refreshes the SWE Interview Prep source registry from a clean machine-local
checkout and commits only semantic changes; no model is invoked.

The deterministic `marketing-control-loop` runs every minute. It renders only
content explicitly accepted in SaaS Maker and releases only separately approved,
due Instagram/YouTube distribution requests. Missing credentials leave it in a
quiet waiting state. Idempotency claims and retry state persist under
`~/Library/Application Support/Fleet Ops/marketing-publications/`.

The supervised `weekly-domain-intelligence` job runs Mondays at 09:30 local.
It refreshes drank Domain Rating history for the nine owned domains, runs three
mobile PSI Swarm samples per domain, and refreshes the public aggregate feed.

Reader saves use the existing authenticated Reader export. Configure its
machine-local token without committing it:

```bash
./scripts/agent-bin/sync-learning-sources configure-reader
```

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

OpenClaw Telegram is the primary delivery surface for mobile operator pings,
cron results, support agents, and the control plane. Hermes Telegram is optional
for backup delivery or recurring workflows that need a separate bot/runtime. If
Hermes is enabled, it must use a different Telegram bot token.

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

### Learning control from chat

The `daily-learning` skill is linked into Codex, OpenClaw, and optional Hermes
by `agent-stack.sh install-skills`. Telegram messages such as “sync learning”,
“start a Pace session”, “learning status”, or “complete <session-id>” map to the
same bounded commands:

```sh
../scripts/agent-bin/learning-control sync
../scripts/agent-bin/learning-control today [source]
../scripts/agent-bin/learning-control start [source]
../scripts/agent-bin/learning-control status
../scripts/agent-bin/learning-control complete <session-id>
```

`today` and `start` return a private learning URL. `status` returns only source
freshness and aggregate session state; it never returns Reader bodies,
credentials, answers, or notes. `complete` is idempotent and records control
completion only—the web app remains authoritative for progress and FSRS ratings.
Run `sync` only on an explicit refresh request because it may commit and push an
updated checked-in catalog.

Tailscale SSH is the durable private terminal path. `tmate` is a deprecated,
explicit emergency fallback only; its session links are credentials.

Use `../scripts/agent-stack.sh pause` to stop OpenClaw, the console, notification
service, and the managed Fleet Ops crontab block on a machine. `resume` restores
them. These controls and all shared behavior live in this repository so another
machine can use the same Fleet Ops source of truth without copying credentials.

## Durable notifications

`notifications/` defines the fleet-wide severity, quiet-hours, dedupe, retry,
and delivery policy. `../scripts/agent-bin/fleet-notify` owns the machine-local
outbox and delivery receipts. Cron failures page through OpenClaw Telegram by
default; routine successes remain available as history without generating phone
noise. See `notifications/README.md` for adapters and commands.
