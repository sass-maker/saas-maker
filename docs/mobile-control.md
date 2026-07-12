# Mobile Control

Fleet mobile control keeps its versioned control layer portable and uses a few
explicit hosted-service exceptions:

- OpenClaw gateway for primary Telegram chat, pings, approvals, durable tasks,
  support agents, and the local control UI.
- Fleet notification outbox for dedupe, quiet hours, retries, dead letters, and
  delivery receipts across Hermes Telegram, OpenClaw Telegram, and optional ntfy.
- OpenClaw durable tasks with owner-only Telegram access and unrestricted host
  execution. This is intentionally unsafe and relies on the Telegram allowlist.
- Optional Hermes gateway for backup delivery, recurring digests, or repeat
  workflows that need a separate model provider or bot identity.
- Grok CLI for model-family second opinions and parallel attempts.
- Optional Devin integration for explicitly approved proprietary agent work.
- Tailscale SSH for durable private phone-to-machine access.
- A normal mobile SSH client such as Prompt, Blink, Termius, or iSH.
- `tmate` only as a deprecated emergency fallback.
- Fleet Ops console for public, sanitized status. Operational detail stays
  behind Tailscale or Cloudflare Access.

Teammate boards sit on top of OpenClaw. See `docs/teammate-boards.md` for
personas, boards, and optional dedicated teammate bots.

Fleet's mobile model deliberately keeps the assistant and the workbench
separate. OpenClaw is the conversational control plane for Telegram, approvals,
status, notifications, and routing. Serious implementation work still happens
in terminal sessions on the machine, usually through Codex or Claude running
inside `tmux` so phone or iPad disconnects do not stop the work.

## What You Need To Provide

1. One baseline Telegram bot token from BotFather for OpenClaw.
2. Your numeric Telegram user ID.
3. Optional private Fleet Ops group or topic ID.
4. Tailscale login on this Mac, the second Mac, and your phone.
5. Tailscale SSH ACL allowing your identity to SSH into the machines.
6. A mobile SSH client such as Termius, Blink Shell, iSH, or any normal SSH app.
7. Grok login if you want Grok teammate runs from this machine.
8. Optional Devin credentials/app access if you explicitly want Devin teammate
   runs: a least-privilege service-user `DEVIN_API_KEY` and `DEVIN_ORG_ID`.
9. Later, an extra BotFather token only for Hermes or a teammate that genuinely
   needs a separate identity or permission boundary. Most personas route through
   the OpenClaw bot.

Do not commit tokens. Configure them from local environment variables:

```sh
export OPENCLAW_TELEGRAM_BOT_TOKEN='...'
export TELEGRAM_ALLOWED_USERS='123456789'
export TELEGRAM_HOME_CHANNEL='123456789'
# optional: export HERMES_TELEGRAM_BOT_TOKEN='...'
./fleet-ops/scripts/agent-bin/mobile-control configure-telegram
```

If using a group:

```sh
export TELEGRAM_GROUP_ALLOWED_CHATS='-1001234567890'
```

For a teammate with its own visible Telegram identity:

```sh
export SHIP_TELEGRAM_BOT_TOKEN='...'
./fleet-ops/scripts/agent-bin/create-teammate ship \
  --board shipping \
  --mention @shipbot \
  --token-env SHIP_TELEGRAM_BOT_TOKEN
```

## Commands

```sh
./fleet-ops/scripts/agent-stack.sh resume
./fleet-ops/scripts/agent-bin/mobile-control status
./fleet-ops/scripts/agent-bin/mobile-control start-tailscale
./fleet-ops/scripts/agent-bin/mobile-control serve-dashboard
./fleet-ops/scripts/agent-bin/mobile-control ping "Fleet is online"
```

Emergency only, after accepting the credential risk:

```sh
./fleet-ops/scripts/agent-bin/mobile-control emergency-tmate --i-understand
```

tmate links are credentials. They never belong on the public dashboard or in
logs, issues, commits, or unauthenticated messages.

## Two-Machine Model

The primary Mac is the coordinator and may host a small number of intentional
machine workloads. The second Mac is a private execution node with no public
ingress or public products. Both join the tailnet; the primary OpenClaw gateway
routes work by node identity so every machine does not need duplicate public chat
bots.

For a second machine:

1. Clone `sarthak-fleet/fleet-ops` into `~/Desktop/fleet/fleet-ops`.
2. Run `./fleet-ops/scripts/agent-stack.sh install-skills`.
3. Run `./fleet-ops/scripts/agent-bin/mobile-control start-tailscale`.
4. Give it a unique `FLEET_NODE_ID` and keep machine-local credentials on that
   machine only.
5. Configure separate Telegram bots only if the node needs an independent
   operator identity. The default is routing through the primary pair.

## Public And Private Surfaces

Public `fleet.sassmaker.com` may show project state, hosting location, deploy
health, schedule summaries, and coarse machine/service health. It must not show
machine hostnames, IPs, usernames, terminal links, tokens, pairing codes,
private repository URLs, raw logs, or operational controls.

Private access uses Tailscale SSH today. A future detailed web control surface
must be protected by Cloudflare Access before it is exposed through a public
hostname.
