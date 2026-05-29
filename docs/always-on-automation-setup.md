# Always-On Automation Setup

Use this when moving local Codex automations to an always-on Mac.

## Bootstrap the fleet checkout

First clone SaaS Maker itself into the expected fleet path:

```bash
mkdir -p /Users/sarthak/Desktop/fleet
cd /Users/sarthak/Desktop/fleet
git clone https://github.com/sarthakagrawal927/saas-maker.git
```

Then from the SaaS Maker repo on the target machine:

```bash
cd /Users/sarthak/Desktop/fleet/saas-maker
pnpm install --frozen-lockfile
pnpm fleet:clone -- --dry-run
pnpm fleet:clone
```

If the target machine should avoid SSH remotes, use HTTPS:

```bash
pnpm fleet:clone -- --https
```

To fast-forward existing checkouts later:

```bash
pnpm fleet:clone -- --pull
```

The clone command reads `foundry.projects.json`, creates missing project
directories under `/Users/sarthak/Desktop/fleet`, skips existing repos by
default, and does not touch secrets or env files.

## Required local auth

## Install Codex automations

After cloning this repo, copy the checked-in automation templates into Codex:

```bash
mkdir -p ~/.codex/automations
cp -R codex-automations/* ~/.codex/automations/
```

These templates include only `automation.toml` files. They do not include
per-run memory, secrets, env files, API keys, SSH keys, or cloud credentials.

Run these manually on the target machine:

```bash
gh auth login
fnd login
```

Also log in to Codex, PostHog, Cloudflare, and browser sessions only where the
automation needs those tools. Do not copy env files, API keys, SSH keys, or
cloud credentials from another machine.

## Smoke the setup

```bash
pnpm symphony --json --no-cache
pnpm fleet:prod-smoke -- --timeout-ms 45000
pnpm fleet:monitoring-audit -- --json
```

If the repo paths differ from `/Users/sarthak/Desktop/fleet`, update the
automation `cwds` and prompts before enabling the schedules.
