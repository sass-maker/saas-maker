#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FLEET_OPS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

usage() {
  cat <<'EOF'
usage: agent-stack.sh <command>

Commands:
  install-skills  Link Fleet Ops skills into local agent runtimes.
  install-agents  Register Fleet support projects as OpenClaw agents.
  mobile          Show or configure mobile control surfaces.
  install-cron    Install Fleet Ops Codex cron jobs.
  remove-cron     Remove Fleet Ops Codex cron jobs.
  cron-ui         Render the local Codex cron dashboard.
  notify          Send or inspect a durable Fleet notification.
  console         Start the Fleet Ops public console.
  check           Validate local OpenClaw, Hermes, Telegram, and security state.
  start           Start OpenClaw, Hermes, console, and scheduled work.
  pause           Stop OpenClaw, Hermes, console, and scheduled work.
  resume          Start OpenClaw, Hermes, console, and scheduled work.
  restart         Restart OpenClaw, Hermes, and the console.
  status          Show gateway, cron, mobile, and paired-device status.
EOF
}

install_skills() {
  local dir
  local skill

  for dir in "$HOME/.codex/skills" "$HOME/.hermes/skills" "$HOME/.openclaw/skills"; do
    mkdir -p "$dir"
    ln -sfn "$FLEET_OPS_DIR/skills/fleet-ops" "$dir/fleet-ops"
    ln -sfn "$FLEET_OPS_DIR/teammates/skills/call-teammate" "$dir/call-teammate"
    ln -sfn "$FLEET_OPS_DIR/teammates/skills/call-codex" "$dir/call-codex"
    ln -sfn "$FLEET_OPS_DIR/teammates/skills/call-grok" "$dir/call-grok"
    ln -sfn "$FLEET_OPS_DIR/teammates/skills/call-hermes" "$dir/call-hermes"
    ln -sfn "$FLEET_OPS_DIR/teammates/skills/call-devin" "$dir/call-devin"
    ln -sfn "$FLEET_OPS_DIR/psi-swarm" "$dir/psi-swarm"
    for skill in name-domains spec-driven agent-ready seo-audit token-budget; do
      ln -sfn "$FLEET_OPS_DIR/skills/$skill" "$dir/$skill"
    done
  done
}

case "${1:-}" in
  install-skills) install_skills ;;
  install-agents) "$FLEET_OPS_DIR/scripts/agent-bin/setup-openclaw-support-agents" "${@:2}" ;;
  mobile) "$FLEET_OPS_DIR/scripts/agent-bin/mobile-control" "${@:2}" ;;
  install-cron) "$FLEET_OPS_DIR/scripts/agent-bin/install-codex-cron" ;;
  remove-cron) "$FLEET_OPS_DIR/scripts/agent-bin/install-codex-cron" --remove ;;
  cron-ui) "$FLEET_OPS_DIR/scripts/agent-bin/render-codex-cron-ui" ;;
  notify) "$FLEET_OPS_DIR/scripts/agent-bin/fleet-notify" "${@:2}" ;;
  console) "$FLEET_OPS_DIR/scripts/agent-bin/ops-console" start ;;
  check)
    openclaw config validate
    openclaw plugins doctor
    openclaw channels status --deep || true
    openclaw security audit
    if command -v hermes >/dev/null 2>&1; then
      hermes doctor || true
      hermes status --deep || true
    fi
    "$FLEET_OPS_DIR/scripts/agent-bin/mobile-control" status
    ;;
  start|resume)
    "$FLEET_OPS_DIR/scripts/agent-stack.sh" install-skills
    if command -v hermes >/dev/null 2>&1; then
      hermes gateway install --start-now --start-on-login || hermes gateway start || true
    fi
    openclaw plugins enable telegram >/dev/null 2>&1 || true
    openclaw gateway start
    "$FLEET_OPS_DIR/scripts/agent-bin/ops-console" start
    "$FLEET_OPS_DIR/scripts/agent-bin/fleet-notification-service" start
    "$FLEET_OPS_DIR/scripts/agent-bin/install-codex-cron"
    ;;
  pause)
    openclaw gateway stop
    if command -v hermes >/dev/null 2>&1; then
      hermes gateway stop || true
    fi
    "$FLEET_OPS_DIR/scripts/agent-bin/ops-console" stop
    "$FLEET_OPS_DIR/scripts/agent-bin/fleet-notification-service" stop
    "$FLEET_OPS_DIR/scripts/agent-bin/install-codex-cron" --remove
    ;;
  restart)
    openclaw gateway restart
    if command -v hermes >/dev/null 2>&1; then
      hermes gateway restart || hermes gateway start || true
    fi
    "$FLEET_OPS_DIR/scripts/agent-bin/ops-console" restart
    "$FLEET_OPS_DIR/scripts/agent-bin/fleet-notification-service" restart
    "$FLEET_OPS_DIR/scripts/agent-bin/install-codex-cron"
    ;;
  status)
    openclaw status --all
    openclaw channels list --all | sed -n '/Telegram/p' || true
    if command -v hermes >/dev/null 2>&1; then
      hermes gateway status || true
      hermes status | sed -n '1,120p' || true
    fi
    openclaw cron status
    openclaw nodes status
    "$FLEET_OPS_DIR/scripts/agent-bin/ops-console" status
    "$FLEET_OPS_DIR/scripts/agent-bin/fleet-notification-service" status
    "$FLEET_OPS_DIR/scripts/agent-bin/fleet-notify" status
    "$FLEET_OPS_DIR/scripts/agent-bin/mobile-control" status
    crontab -l 2>/dev/null | sed -n '/BEGIN FLEET OPS CODEX CRON/,/END FLEET OPS CODEX CRON/p' || true
    ;;
  -h|--help|help|"") usage ;;
  *)
    usage >&2
    exit 2
    ;;
esac
