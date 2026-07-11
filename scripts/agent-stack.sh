#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FLEET_OPS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

usage() {
  cat <<'EOF'
usage: agent-stack.sh <command>

Commands:
  install-skills  Link Fleet Ops skills into local agent runtimes.
  check           Validate the local OpenClaw control plane and security state.
  start           Start the local OpenClaw gateway.
  pause           Stop the local OpenClaw gateway and its scheduled work.
  resume          Start the local OpenClaw gateway after a pause.
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
  check)
    openclaw config validate
    openclaw plugins doctor
    openclaw security audit
    ;;
  start|resume) openclaw gateway start ;;
  pause) openclaw gateway stop ;;
  restart) openclaw gateway restart ;;
  status)
    openclaw status --all
    openclaw cron status
    openclaw nodes status
    ;;
  -h|--help|help|"") usage ;;
  *)
    usage >&2
    exit 2
    ;;
esac
