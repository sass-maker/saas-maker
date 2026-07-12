# Codex Cron

Versioned replacement for the Codex app automation schedules.

`jobs.tsv` contains conversational Codex jobs. `system-jobs.tsv` contains
deterministic jobs that do not need a model, including the nightly learning
source sync.

## Commands

```sh
fleet-ops/scripts/agent-bin/install-codex-cron
fleet-ops/scripts/agent-bin/run-codex-cron daily-fleet-health-sentinel --dry-run
fleet-ops/scripts/agent-bin/render-codex-cron-ui
```

`install-codex-cron` writes a managed `# BEGIN FLEET OPS CODEX CRON` block to the
user crontab. It preserves any unrelated crontab lines.

Runtime logs and locks stay local under this directory and are intentionally not
committed.
