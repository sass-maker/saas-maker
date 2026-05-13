#!/usr/bin/env bash
set -euo pipefail

RUNNER_ID="${DROID_RUNNER_ID:-$(scutil --get ComputerName 2>/dev/null || hostname)}"
DROID_HOME="${DROID_HOME:-$HOME/Droid}"
WORKSPACE_ROOT="${DROID_WORKSPACE_ROOT:-$DROID_HOME/workspaces}"
LOG_DIR="$DROID_HOME/logs"
STATE_DIR="$DROID_HOME/state"
ENV_EXAMPLE="$DROID_HOME/runner.env.example"
PLIST_OUT="$DROID_HOME/com.saas-maker.droid-runner.plist"
INSTALL_TOOLS=0

usage() {
  cat <<'EOF'
Usage:
  scripts/setup-droid-runner-mac.sh [--install-tools]

Sets up a Mac to act as a Droid runner host.

What it does:
  - Creates ~/Droid/{workspaces,logs,state}
  - Checks git, gh, node, pnpm, cloudflared, tailscale
  - Optionally installs free local tools with Homebrew
  - Writes a secrets-free runner.env.example
  - Writes a launchd plist template into ~/Droid/

It does not write API keys, GitHub tokens, or production env files.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --install-tools)
      INSTALL_TOOLS=1
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log() {
  printf '\n==> %s\n' "$*"
}

warn() {
  printf 'WARN: %s\n' "$*" >&2
}

have() {
  command -v "$1" >/dev/null 2>&1
}

install_formula() {
  local name="$1"
  if [[ "$INSTALL_TOOLS" != "1" ]]; then
    warn "$name is missing. Re-run with --install-tools to install via Homebrew."
    return
  fi
  if ! have brew; then
    warn "Homebrew is missing; cannot install $name automatically."
    return
  fi
  brew install "$name"
}

install_cask() {
  local name="$1"
  if [[ "$INSTALL_TOOLS" != "1" ]]; then
    warn "$name is missing. Re-run with --install-tools to install via Homebrew."
    return
  fi
  if ! have brew; then
    warn "Homebrew is missing; cannot install $name automatically."
    return
  fi
  brew install --cask "$name"
}

log "Creating Droid runner folders"
mkdir -p "$WORKSPACE_ROOT" "$LOG_DIR" "$STATE_DIR"

log "Checking macOS command line tools"
if ! xcode-select -p >/dev/null 2>&1; then
  warn "Xcode Command Line Tools are missing. Run: xcode-select --install"
else
  xcode-select -p
fi

log "Checking free local dependencies"
if have git; then git --version; else install_formula git; fi
if have gh; then gh --version | head -1; else install_formula gh; fi
if have node; then node --version; else install_formula node; fi
if have pnpm; then pnpm --version; else
  if have corepack; then
    corepack enable
    corepack prepare pnpm@latest --activate
  else
    install_formula pnpm
  fi
fi
if have cloudflared; then cloudflared --version; else install_formula cloudflared; fi
if have tailscale; then tailscale version | head -1; else install_cask tailscale; fi

log "Checking GitHub auth"
if have gh && gh auth status >/dev/null 2>&1; then
  gh auth status
else
  warn "GitHub CLI is not authenticated. Run on the spare Mac: gh auth login"
fi

log "Checking Tailscale"
if have tailscale && tailscale status >/dev/null 2>&1; then
  tailscale status | sed -n '1,12p'
else
  warn "Tailscale is installed but not logged in/running, or the CLI cannot reach it."
  warn "Open the Tailscale app and log in. Optional: enable Tailscale SSH in Tailscale admin."
fi

log "Writing secrets-free env example"
cat > "$ENV_EXAMPLE" <<EOF
# Copy this to a private location if you want, then fill values manually.
# Do not commit real secrets.

DROID_RUNNER_ID="$RUNNER_ID"
DROID_HOME="$DROID_HOME"
DROID_WORKSPACE_ROOT="$WORKSPACE_ROOT"

# Required once SaaS Maker exposes runner polling endpoints:
# DROID_RUNNER_TOKEN="runner-token-from-saas-maker"
# SAAS_MAKER_API_URL="https://api.sassmaker.com"

# Optional, for native Droid:
# DROID_DEEPSEEK_API_KEY="sk-..."

# Optional, if not relying on gh auth:
# GITHUB_TOKEN="github_pat_..."
EOF
chmod 600 "$ENV_EXAMPLE"

log "Writing launchd plist template"
cat > "$PLIST_OUT" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.saas-maker.droid-runner</string>

  <key>WorkingDirectory</key>
  <string>$repo_root</string>

  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>-lc</string>
    <string>pnpm droid:local -- --mock --workspace "$WORKSPACE_ROOT/smoke" --prompt "Create docs/launchd-smoke.md and verify it exists."</string>
  </array>

  <key>RunAtLoad</key>
  <true/>

  <key>KeepAlive</key>
  <false/>

  <key>StandardOutPath</key>
  <string>$LOG_DIR/runner.out.log</string>

  <key>StandardErrorPath</key>
  <string>$LOG_DIR/runner.err.log</string>
</dict>
</plist>
EOF

log "Running local Droid mock smoke"
mkdir -p "$WORKSPACE_ROOT/smoke"
pnpm --dir "$repo_root" droid:local -- --mock --workspace "$WORKSPACE_ROOT/smoke" --prompt "Create docs/runner-setup-smoke.md and verify it exists."

log "Runner host is ready for the next software step"
cat <<EOF

Created:
  $WORKSPACE_ROOT
  $LOG_DIR
  $STATE_DIR
  $ENV_EXAMPLE
  $PLIST_OUT

Next manual steps on the spare Mac:
  1. Open Tailscale and log in.
  2. Run: gh auth login
  3. Keep the Mac awake while plugged in:
     sudo pmset -c sleep 0
     sudo pmset -c displaysleep 30

Once we add the polling runner, this Mac will run that instead of the launchd smoke command.
EOF
