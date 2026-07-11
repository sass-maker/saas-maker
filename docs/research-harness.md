# Research Harness

Fleet uses the existing `call-teammate` delegation layer rather than a separate
multi-agent control plane. The local OpenClaw gateway is the persistent operator
interface; Fleet Ops owns the reusable routing, skills, scripts, and evidence
standards.

## Lanes

| Lane | Runtime | Best use | Guardrail |
| --- | --- | --- | --- |
| Primary implementation | Codex | Local code, tests, and Fleet operations | Verify the diff and checks locally |
| Evidence research | OpenClaw `research` agent | Current source-backed decisions | Isolated workspace, no channel bindings or heartbeat |
| Independent review | Grok CLI | Cross-model challenge and alternate hypotheses | Read-only plan mode; requires `grok login` |
| Self-improving specialist | Hermes Agent | On-demand learning and repeat-work workflows | Open-source runtime; keep its gateway and channels disabled by default |

The research agent workspace is `~/Desktop/fleet/research-agent`. Its reports
are written to `research-agent/reports/` and must follow its evidence-research
skill. It is intentionally not exposed as a general Fleet skill because it has
its own narrow tool policy and artifact boundary.

## Commands

```bash
./fleet-ops/scripts/agent-bin/harness-health
./fleet-ops/scripts/agent-bin/research-dispatch "Compare options for ..."
./fleet-ops/scripts/agent-bin/grok-research-review "Challenge report ..."
```

The control plane should improve decisions or remove recurring work. Do not add
new providers, plugins, channels, schedules, or memory backends merely because
they are available. Add an integration only after it has a concrete recurring
job, a named owner, a failure mode, and a measurable benefit.

Fleet tooling must be open source. Codex and Grok are permitted as model
providers; proprietary agent platforms such as Devin are not active Fleet
dependencies.
