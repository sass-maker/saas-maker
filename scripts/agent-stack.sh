#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FLEET_OPS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

usage() {
  cat <<'EOF'
usage: agent-stack.sh <command>

Commands:
  install-skills  Link Fleet Ops skills into local agent runtimes.
  install-cron    Install Fleet Ops Codex cron jobs.
  remove-cron     Remove Fleet Ops Codex cron jobs.
  cron-ui         Render the local Codex cron dashboard.
  console         Start the Fleet Ops public console.
  check           Validate the local OpenClaw control plane and security state.
  start           Start the local OpenClaw gateway, console, and scheduled work.
  pause           Stop the local OpenClaw gateway, console, and scheduled work.
  resume          Start the local OpenClaw gateway, console, and scheduled work.
  restart         Restart the local OpenClaw gateway.
  status          Show gateway, cron, and paired-device status.
EOF
}

install_skills() {
  local dir
  local skill

  for dir in "$HOME/.codex/skills" "$HOME/.hermes/skills"; do
    mkdir -p "$dir"
    ln -sfn "$FLEET_OPS_DIR/skills/fleet-ops" "$dir/fleet-ops"
    ln -sfn "$FLEET_OPS_DIR/teammates/skills/call-teammate" "$dir/call-teammate"
    for skill in name-domains spec-driven psi-swarm agent-ready seo-audit token-budget; do
      ln -sfn "$FLEET_OPS_DIR/skills/$skill" "$dir/$skill"
    done
  done
}

case "${1:-}" in
  install-skills) install_skills ;;
  install-cron) "$FLEET_OPS_DIR/scripts/agent-bin/install-codex-cron" ;;
  remove-cron) "$FLEET_OPS_DIR/scripts/agent-bin/install-codex-cron" --remove ;;
  cron-ui) "$FLEET_OPS_DIR/scripts/agent-bin/render-codex-cron-ui" ;;
  console) "$FLEET_OPS_DIR/scripts/agent-bin/ops-console" start ;;
  check)
    openclaw config validate
    openclaw plugins doctor
    openclaw security audit
    ;;
  start|resume)
    openclaw gateway start
    "$FLEET_OPS_DIR/scripts/agent-bin/ops-console" start
    "$FLEET_OPS_DIR/scripts/agent-bin/install-codex-cron"
    ;;
  pause)
    openclaw gateway stop
    "$FLEET_OPS_DIR/scripts/agent-bin/ops-console" stop
    "$FLEET_OPS_DIR/scripts/agent-bin/install-codex-cron" --remove
    ;;
  restart)
    openclaw gateway restart
    "$FLEET_OPS_DIR/scripts/agent-bin/ops-console" restart
    "$FLEET_OPS_DIR/scripts/agent-bin/install-codex-cron"
    ;;
  status)
    openclaw status --all
    openclaw cron status
    openclaw nodes status
    "$FLEET_OPS_DIR/scripts/agent-bin/ops-console" status
    crontab -l 2>/dev/null | sed -n '/BEGIN FLEET OPS CODEX CRON/,/END FLEET OPS CODEX CRON/p' || true
    ;;
  -h|--help|help|"") usage ;;
  *)
    usage >&2
    exit 2
    ;;
esac
