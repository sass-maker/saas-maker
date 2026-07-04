#!/usr/bin/env bash
#
# Deploy readiness gate — verifies a project is safe to deploy before
# allowing the deploy command to run. Backs the fleet-deploy-guard skill.
#
# Usage:
#   bash fleet-ops/scripts/fleet-deploy-guard.sh <project>
#   bash fleet-ops/scripts/fleet-deploy-guard.sh saas-maker
#   bash fleet-ops/scripts/fleet-deploy-guard.sh saas-maker --force  # skip CI check

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FORCE=false

if [[ $# -lt 1 ]]; then
  echo "Usage: fleet-deploy-guard.sh <project> [--force]" >&2
  exit 1
fi

PROJECT="$1"
shift

while [[ $# -gt 0 ]]; do
  case "$1" in
    --force) FORCE=true; shift ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

DIR="$ROOT/$PROJECT"

if [[ ! -d "$DIR/.git" ]]; then
  echo "PROJECT: $PROJECT"
  echo "  ✗ no .git directory at $DIR"
  exit 1
fi

cd "$DIR"

pass=0
fail=0
gates=""

check() {
  local label="$1"
  local result="$2"
  local detail="$3"
  if [[ "$result" == "ok" ]]; then
    gates+="$(printf '%-20s %s ✓ %s\n' "$label" "" "$detail")\n"
    pass=$((pass + 1))
  else
    gates+="$(printf '%-20s %s ✗ %s\n' "$label" "" "$detail")\n"
    fail=$((fail + 1))
  fi
}

# 1. On main branch?
branch=$(git branch --show-current 2>/dev/null || echo "DETACHED")
if [[ "$branch" == "main" ]]; then
  check "Branch" "ok" "main"
else
  check "Branch" "fail" "on $branch (not main)"
fi

# 2. Clean working tree?
if [[ -z "$(git status --porcelain 2>/dev/null)" ]]; then
  check "Git" "ok" "clean"
else
  dirty_count=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
  check "Git" "fail" "dirty ($dirty_count uncommitted files)"
fi

# 3. Synced with remote?
upstream=$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true)
if [[ -n "$upstream" ]]; then
  read -r behind ahead < <(git rev-list --left-right --count "$upstream...HEAD" 2>/dev/null || echo "0 0")
  if [[ "$ahead" -eq 0 && "$behind" -eq 0 ]]; then
    check "Remote" "ok" "synced"
  else
    check "Remote" "fail" "ahead=$ahead behind=$behind"
  fi
else
  check "Remote" "fail" "no upstream configured"
fi

# 4. CI green on main?
if [[ "$FORCE" == true ]]; then
  check "CI" "ok" "skipped (--force)"
else
  ci_result="unknown"
  ci_detail=""

  if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
    url=$(git remote get-url origin 2>/dev/null || true)
    slug=""
    case "$url" in
      git@github.com:*) slug="${url#git@github.com:}" ;;
      https://github.com/*) slug="${url#https://github.com/}" ;;
    esac
    slug="${slug%.git}"

    if [[ -n "$slug" ]]; then
      conclusion=$(gh run list -R "$slug" --branch main --limit 1 \
        --json conclusion -q '.[0].conclusion // "none"' 2>/dev/null || echo "none")
      case "$conclusion" in
        success) ci_result="ok"; ci_detail="green" ;;
        failure|cancelled|timed_out|action_required|startup_failure)
          ci_result="fail"; ci_detail="red ($conclusion)"
          ;;
        *) ci_result="fail"; ci_detail="no runs on main" ;;
      esac
    else
      ci_result="fail"; ci_detail="no GitHub remote"
    fi
  else
    ci_result="fail"; ci_detail="gh not available"
  fi

  check "CI" "$ci_result" "$ci_detail"
fi

# 5. Cloudflare target known?
cf_target=""
for f in wrangler.toml wrangler.jsonc wrangler.json; do
  if [[ -f "$f" ]]; then
    if [[ "$f" == *.json* ]] && command -v jq >/dev/null 2>&1; then
      cf_target=$(jq -r '.name // empty' "$f" 2>/dev/null || true)
    elif [[ "$f" == *.toml ]]; then
      cf_target=$(grep -E '^\s*name\s*=' "$f" 2>/dev/null | head -1 | sed -E 's/.*=\s*"([^"]+)".*/\1/' || true)
    fi
    [[ -n "$cf_target" ]] && break
  fi
done

if [[ -n "$cf_target" ]]; then
  check "CF target" "ok" "$cf_target"
else
  check "CF target" "fail" "no wrangler config found"
fi

# 6. Blockers in PROJECT_STATUS.md?
blockers=""
if [[ -f "PROJECT_STATUS.md" ]]; then
  blockers=$(grep -i -A1 'blocked\|blocker' PROJECT_STATUS.md 2>/dev/null | head -3 || true)
fi

if [[ -z "$blockers" ]]; then
  check "Blockers" "ok" "none flagged"
else
  check "Blockers" "fail" "see PROJECT_STATUS.md"
fi

# Output
echo "PROJECT: $PROJECT"
echo ""
printf "$gates"
echo ""

if [[ $fail -gt 0 ]]; then
  echo "→ NOT READY — fix $fail gate(s) above before deploying"
  exit 1
else
  echo "→ READY TO DEPLOY ($pass gates passed)"
  exit 0
fi
