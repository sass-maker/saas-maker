# Teammate Boards

Fleet teammates are personas first. A teammate can be:

- a lightweight persona under the main OpenClaw bot;
- a dedicated OpenClaw agent with its own workspace and board;
- a dedicated Telegram bot account bound to that agent when it needs a visible
  `@botname` in group chat.
- a non-chat model teammate such as Grok or Devin behind a routed OpenClaw or
  Hermes persona.

## Default Shape

Use two baseline bots first:

- OpenClaw bot: primary mobile operator, pings, cron delivery, approvals, and
  project routing.
- Hermes bot: optional backup/persistent lane for repeat workflows that need a
  separate runtime.
- OpenClaw bot: support-agent router, project agents, teammate boards.
- Grok: model teammate for second opinions and best-of-N attempts.
- Devin: optional proprietary teammate, only when explicitly approved.

Do not create one Telegram bot per idea. Create a dedicated teammate bot only
when you need a distinct group-chat identity, stable routing, different
permissions, or a stable board persona that can call Grok/Devin behind the
scenes.

## Group Chat UX

For a teammate that genuinely needs its own Telegram identity:

1. Create a BotFather bot only for that visible teammate.
2. Add every teammate bot to the private Fleet group.
3. Disable BotFather privacy mode for each bot, or make each bot a group admin.
4. Remove and re-add bots after changing privacy mode.
5. Bind each Telegram account to its OpenClaw agent.
6. Mention the bot username in the group, e.g. `@shipbot prepare release notes`.

OpenClaw routes by `channel + accountId`, so a dedicated bot can talk as an
isolated agent/persona. The normal case is one OpenClaw bot routing mentions or
commands to lightweight personas; this avoids bot sprawl and duplicated polling.

Grok and Devin do not need their own Telegram accounts by default. Create a
visible teammate bot such as `@reviewbot` or `@shipbot`, then let that persona
use `call-grok` or `call-devin` when appropriate.

## Create A Teammate

Without a dedicated Telegram bot:

```sh
./fleet-ops/scripts/agent-bin/create-teammate ship \
  --board shipping \
  --mention @shipbot
```

With a dedicated Telegram bot:

```sh
export SHIP_TELEGRAM_BOT_TOKEN='...'
./fleet-ops/scripts/agent-bin/create-teammate ship \
  --board shipping \
  --mention @shipbot \
  --token-env SHIP_TELEGRAM_BOT_TOKEN
```

The script creates:

```text
fleet-ops/teammates/boards/<board>/<teammate>/
├── AGENTS.md
└── SOUL.md
```

Then it registers the OpenClaw agent and, when a token env var is provided,
adds a Telegram account and binding.

## Boards

Boards are just folders plus conventions. Start with:

- `ops`: machine, dashboard, Cloudflare, schedules, incident work.
- `shipping`: PRs, releases, QA, deployment readiness.
- `marketing`: domains, SEO, positioning, content plans.
- `research`: evidence gathering and source-backed decisions.
- `product`: roadmap, scope, project state, tradeoffs.

Each board can later grow its own dashboard lane, Telegram topic, or dedicated
teammate bots.
