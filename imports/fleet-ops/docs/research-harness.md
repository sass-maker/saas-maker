# Research Harness

Fleet uses the existing `call-teammate` delegation layer plus one primary
operator gateway: OpenClaw. OpenClaw owns Telegram control, support-agent
routing, durable tasks, approvals, and its control UI. Hermes remains an
optional persistent/backup runtime for recurring workflows that need a separate
model provider or bot identity.
Fleet Ops owns the reusable routing, skills, scripts, mobile-control setup, and
evidence standards.

OpenClaw is the conversational assistant and control plane, not the raw coding
surface. Important implementation work should still run from terminal sessions
on the machine through Codex, Claude, or an explicitly selected teammate.

## Lanes

| Lane | Runtime | Best use | Guardrail |
| --- | --- | --- | --- |
| Primary implementation | Codex / Claude from terminal | Local code, tests, implementation loops, and Fleet operations | Keep long runs in `tmux`; verify the diff and checks locally |
| Operator control | OpenClaw | Always-on Telegram, approvals, durable tasks, project routing, mobile requests | Owner allowlist and explicit approval flow |
| Optional persistent lane | Hermes Agent | Backup bot, recurring digests, repeat-work learning, separate provider quota | Optional open-source runtime; configure only when the lane has a named job |
| Support agents | OpenClaw agents | Project-specific routing, dashboard, pairing, and support workspaces | Each support agent stays scoped to its project |
| Independent review | Grok CLI | Cross-model challenge and alternate hypotheses | Read-only plan mode; requires `grok login` |
| Evidence research | OpenClaw `research` agent | Current source-backed decisions | Isolated workspace and evidence artifacts |
| Optional external teammate | Devin | Proprietary autonomous attempts when the upside justifies spend | Explicit approval required; verify diffs locally |

The research agent workspace is `~/Desktop/fleet/research-agent`. Its reports
are written to `research-agent/reports/` and must follow its evidence-research
skill. It is intentionally not exposed as a general Fleet skill because it has
its own narrow tool policy and artifact boundary.

## Commands

```bash
./fleet-ops/scripts/agent-bin/harness-health
./fleet-ops/scripts/agent-stack.sh install-skills
./fleet-ops/scripts/agent-stack.sh install-agents
./fleet-ops/scripts/agent-stack.sh resume
./fleet-ops/scripts/agent-bin/mobile-control needs
./fleet-ops/scripts/agent-bin/mobile-control configure-telegram
./fleet-ops/scripts/agent-bin/mobile-control ping
./fleet-ops/scripts/agent-bin/research-dispatch "Compare options for ..."
./fleet-ops/scripts/agent-bin/grok-research-review "Challenge report ..."
```

`install-skills` links Fleet skills into Codex, Hermes, and OpenClaw.
`install-agents` registers Fleet support workspaces as isolated OpenClaw agents:
`fleet-ops`, `saas-maker`, `free-ai`, `reel-pipeline`, `drank`, `high-signal`,
`knowledge-base`, `research-papers`, `aliveville`, `codevetter`, and
`starboard`.

Hermes is not required for the primary mobile path. If a machine enables Hermes
as an optional lane, it must use a separate Telegram bot token from OpenClaw.
Telegram long polling allows one active gateway per token; sharing a token
causes one gateway to disconnect the other. Use `mobile-control
configure-telegram` with local environment variables so secrets stay out of git.

For mobile terminal control, Fleet uses a private-first path:

- Tailscale SSH for private tailnet access from a phone SSH client.
- Any normal mobile SSH client, such as Prompt, Blink, Termius, or iSH.
- `tmate` only as a deprecated, explicit emergency fallback when Tailscale is unavailable.

Private terminal links must not be shown on the public dashboard. Send them only
through an authenticated channel or read them from the local command output.
Use those terminal sessions as the raw coding surface for Codex, Claude, test
runs, and deploy checks. OpenClaw should notify, approve, and route; it should
not be treated as the terminal replacement.

Use a project id directly for targeted support work, for example:

```bash
openclaw agent --agent reel-pipeline --message "Read AGENTS.md and PROJECT_STATUS.md, then summarize current render readiness."
```

The control plane should improve decisions or remove recurring work. Telegram
and Tailscale SSH are baseline operator surfaces; additional providers,
plugins, channels, schedules, or memory backends still need a concrete recurring
job, a named owner, a failure mode, and a measurable benefit.

Fleet keeps orchestration, skills, schedules, and portable configuration open
source where practical. Cloudflare, Telegram, Tailscale's hosted control plane,
Codex, and Grok are approved service/provider exceptions. Devin is allowed only
as an optional proprietary teammate after explicit approval for the spend and
lock-in tradeoff. Headscale remains a future option if a self-hosted Tailscale
control plane becomes worth its maintenance cost.
