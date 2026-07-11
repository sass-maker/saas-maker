# Codex CLI — subscription-backed fleet automation

How to run **personal, local agents over the fleet using a ChatGPT subscription**
(Plus/Pro) instead of per-token API keys. Goal: flat-cost automation, not metered
billing.

> **Why Codex and not Claude for this?** Anthropic walls the subscription off from
> programmatic use — the Agent SDK *requires* an API key, and routing Max/Pro
> credentials through automation is prohibited and enforced. The only Claude
> subscription-automation lane is the narrow `claude setup-token` CLI path. OpenAI,
> by contrast, makes "Sign in with ChatGPT" a first-class auth flow that `codex exec`
> reuses. So Codex is the practical substrate for subscription-backed local agents.

Facts below verified against [developers.openai.com/codex](https://developers.openai.com/codex)
and [github.com/openai/codex](https://github.com/openai/codex) (early 2026). Two
items marked *verify locally* — the docs were thin.

---

## Mental model

`codex exec` is the **non-interactive primitive**: hand it a prompt, it runs the full
agent loop autonomously inside the sandbox/approval bounds you set, then exits. A
single `exec` is one bounded unit of work. **You build the agent around it** — the
shell/cron loop that decides which repo, which prompt, and what to do with the output
is yours. Behaviour lives in files (`config.toml` + `AGENTS.md`), not in giant command
lines.

Three config layers stack, CLI args > profile > `config.toml` > built-in default:
1. **`config.toml` / profiles** — model, reasoning effort, default sandbox + approval.
2. **`AGENTS.md`** — behaviour contract; read automatically (see below).
3. **Per-call flags** — override anything for one run.

---

## 1. Auth (and the billing footguns)

```bash
unset OPENAI_API_KEY            # force the subscription path, not API key
codex logout 2>/dev/null        # clear any cached api-key session
codex login                     # browser flow
# headless box: codex login --device-auth   (OAuth device-code)
```

- ChatGPT sign-in draws on your plan's included limits — **no API billing**.
  Subscription auth is reused by headless `codex exec`.
- **Footgun #1** ([#2733](https://github.com/openai/codex/issues/2733)): if
  `OPENAI_API_KEY` is set or an old session is cached, Codex silently bills the API.
  The unset + logout above prevents it.
- **Footgun #2** ([#2000](https://github.com/openai/codex/issues/2000)): legacy
  binaries auto-created a billable `sk-proj-…` key on login. Upgrade, re-login, then
  delete any "Codex CLI (auto-generated)" key in the API dashboard.
- Credentials live in `~/.codex/auth.json` — treat as a password, never commit.
- OpenAI officially *recommends API keys for CI* (rotation/audit). Subscription
  headless is **supported but unblessed** — fine for personal fleet use; expect less
  token-rotation tooling.

Docs: [auth](https://developers.openai.com/codex/auth) ·
[pricing](https://developers.openai.com/codex/pricing)

## 2. `codex exec` for automation

```bash
codex exec -p fix --cd /path/to/repo -o /tmp/out.md \
  "Run lint + typecheck; fix only mechanical errors."
```

Flags that matter for unattended runs ([CLI reference](https://developers.openai.com/codex/cli/reference)):

| Flag | Purpose |
|---|---|
| `-a never` | **Mandatory** — approval mode `never`; otherwise a prompt hangs cron forever. (`-a` enum: `untrusted\|on-request\|never`.) |
| `-s <mode>` | Sandbox: `read-only \| workspace-write \| danger-full-access`. `--full-auto` is deprecated; never use `--yolo` / `--dangerously-bypass-approvals-and-sandbox` outside an isolated runner. |
| `-o <file>` | Write final message to a file. `--json` emits newline-delimited events. |
| `--cd <dir>` | Workspace root. |
| `--ephemeral` | No session files left on disk. |
| `echo ... \| codex exec -` | Pipe prompt from stdin. |

`workspace-write` blocks network/git by default — so `fix` runs can't push or install.
Leave push/PR steps to a separate human-reviewed pass.

## 3. `~/.codex/config.toml` profiles

Encode the task shapes once so cron lines stay short. Global file at
`~/.codex/config.toml`; per-project override at `.codex/config.toml`. TOML format.

```toml
model = "gpt-5.5"                  # verify slug locally (a -codex variant may exist)
approval_policy = "on-request"     # interactive default
sandbox_mode = "workspace-write"

# Read-only sweeps: audits, perf checks, status-drift — cannot touch anything
[profiles.audit]
sandbox_mode = "read-only"
approval_policy = "never"
model_reasoning_effort = "low"     # cheap on rate limits

# Autonomous fixes: writes within the repo, no network/push
[profiles.fix]
sandbox_mode = "workspace-write"
approval_policy = "never"
model_reasoning_effort = "high"
```

`model_reasoning_effort` enum: `minimal | low | medium | high | xhigh`. Profiles are
selected with `-p <name>`. Docs: [config reference](https://developers.openai.com/codex/config-reference).

## 4. AGENTS.md wires in automatically

Codex reads `~/.codex/AGENTS.md` globally, then walks git-root→cwd merging each
directory's `AGENTS.md` (closer-to-cwd wins; 32 KiB cap via `project_doc_max_bytes`).
So the fleet standard at [`fleet/AGENTS.md`](../../AGENTS.md) and per-project ones load
with **zero rework** — Codex inherits the ownership/quality bar.

Keep working rules in `~/.codex/AGENTS.md` (the global `CLAUDE.md` already points
there). Guide: [agents-md](https://developers.openai.com/codex/guides/agents-md).

## 5. MCP

Codex is an MCP **client**: `codex mcp add <name> -- <stdio-command>`, or
`[mcp_servers.<name>]` in `config.toml` (stdio: `command`/`args`/`env`; HTTP: `url` +
`bearer_token_env_var`). Acting *as* an MCP server is not first-party — only
community wrappers around `codex exec`. Docs: [mcp](https://developers.openai.com/codex/mcp).

## 6. Fleet-sweep skeleton

```bash
#!/usr/bin/env bash
set -euo pipefail
FLEET=~/Desktop/fleet
EXCLUDE="everythingrated|open-historia|today-little-log|truehire|verified-bases|companion-robot|device-net-test|forecast-lab|elves-hq|saas-maker-ci-fix|free-ai"   # out-of-fleet + hands-off (see AGENTS.md)

for repo in "$FLEET"/*/; do
  name=$(basename "$repo")
  [[ "$name" =~ $EXCLUDE ]] && continue
  [[ -d "$repo/.git" ]] || continue
  echo "── $name"
  codex exec -p audit --cd "$repo" -o "/tmp/codex-$name.md" \
    "Check PROJECT_STATUS.md against repo state per the fleet AGENTS.md standard. Report drift only; change nothing." \
    || echo "  (skipped: $name)"
done
```

Start on the `audit` (read-only) profile until outputs are trusted, then graduate
specific jobs to `fix`. Excludes out-of-fleet projects and free-ai (hands-off) per
[`AGENTS.md`](../../AGENTS.md).

## 7. Constraints to design around

- **Rate limits are the real ceiling, not money.** One 5-hour rolling window + a weekly
  cap, **shared across all local *and* cloud Codex and interactive use**. A wide sweep
  can drain the weekly cap and lock out interactive work → run sequentially, use `low`
  effort for audits, stagger heavy jobs. Pro 5×/20× exists if one pass routinely blows
  the cap.
- **Sandbox blocks network/git by default** on `workspace-write` — package installs,
  git push, outbound API calls need an explicit network policy or `danger-full-access`.
  Don't reach for that in a non-isolated runner.
- **Verify locally** (docs were thin): the exact model slug (`gpt-5.5` vs a `-codex`
  variant) and your plan's real per-model message counts.

## Models (subscription)

GPT-5.5, GPT-5.4, GPT-5.4-mini, GPT-5.3-Codex-Spark (Pro-only preview). Reasoning
effort lever: `model_reasoning_effort` or `-c model_reasoning_effort=...`.

---

## Sources

- [Codex auth](https://developers.openai.com/codex/auth) ·
  [CLI reference](https://developers.openai.com/codex/cli/reference) ·
  [sandboxing](https://developers.openai.com/codex/concepts/sandboxing)
- [config reference](https://developers.openai.com/codex/config-reference) ·
  [AGENTS.md guide](https://developers.openai.com/codex/guides/agents-md) ·
  [MCP](https://developers.openai.com/codex/mcp) ·
  [pricing](https://developers.openai.com/codex/pricing)
- [github.com/openai/codex](https://github.com/openai/codex) ·
  [#2000](https://github.com/openai/codex/issues/2000) ·
  [#2733](https://github.com/openai/codex/issues/2733)
