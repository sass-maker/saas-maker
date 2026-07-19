# Fleet notifications

Fleet notifications are durable, deduplicated operational events. Producers write
to a machine-local outbox; a launchd worker drains it every minute. Secrets and
message bodies never enter the public dashboard.

## Commands

```bash
fleet-ops/scripts/agent-bin/fleet-notify emit \
  --severity warning --source deploy --project high-signal \
  --title "Deploy needs attention" --body "Production smoke check failed" \
  --url "https://github.com/High-Signal-App/high-signal/actions"

fleet-ops/scripts/agent-bin/fleet-notify status
fleet-ops/scripts/agent-bin/fleet-notify list --limit 20
fleet-ops/scripts/agent-bin/fleet-notification-service start
```

`info` and routine `success` are history-only by default. `warning` pages
through the OpenClaw Telegram bot after quiet hours; `critical` also uses ntfy
when configured and bypasses quiet hours. Override routing for an explicitly
requested completion notification with repeated `--channel` flags.

For terminal-run agents, use:

```bash
fleet-ops/scripts/agent-bin/fleet-notify emit \
  --severity success --source terminal-agent --title "Task complete" \
  --body "Claude/Codex finished the requested work." \
  --channel openclaw-telegram

fleet-ops/scripts/agent-bin/fleet-notify emit \
  --severity warning --source terminal-agent --title "Agent needs help" \
  --body "Claude/Codex is blocked and needs operator input."
```

## Machine-local configuration

The worker reads these environment variables from
`~/Library/Application Support/Fleet Ops/notifications/env` as `KEY=VALUE` lines:

- `OPENCLAW_TELEGRAM_TARGET` (required to use `openclaw-telegram`)
- `HERMES_TELEGRAM_TARGET` (optional, defaults to `telegram`, Hermes' home channel)
- `FLEET_NTFY_URL` (for example a self-hosted server plus topic URL)
- `FLEET_NTFY_TOKEN` (optional bearer token)

Telegram bot tokens remain in Hermes/OpenClaw's own secret stores. The Fleet
notification queue never copies them. Missing adapters leave delivery pending
with a visible `blocked` receipt instead of discarding the event.

## Event contract

Every event has a UUID, schema version, source, optional project, severity,
title, body, URLs, occurrence time, expiry, dedupe key, and resolved channels.
State is stored under `~/Library/Application Support/Fleet Ops/notifications/`.
Completed and dead-letter events are retained for 30 days.
