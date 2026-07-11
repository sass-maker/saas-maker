#!/usr/bin/env bash
#
# Fleet health check — git state, CI signal, and branch status across all
# active fleet projects. Backs the fleet-audit skill (health mode).
#
# Usage:
#   bash fleet-ops/scripts/fleet-health.sh
#   bash fleet-ops/scripts/fleet-health.sh --no-fetch   # skip git fetch
#   bash fleet-ops/scripts/fleet-health.sh --only saas-maker,aliveville

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FETCH=true
ONLY=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-fetch) FETCH=false; shift ;;
    --only) ONLY="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: fleet-health.sh [--no-fetch] [--only slug1,slug2]"
      exit 0
      ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

# Parse active project list from README (lines starting with "- [" under product sections)
get_projects() {
  local readme="$ROOT/README.md"
  [[ -f "$readme" ]] || { echo "README.md not found at $readme" >&2; exit 1; }

  # Extract project slugs from markdown links: - [name](url) — ...
  # Skip sub-product lines (indented with 2 spaces)
  grep -E '^- \[' "$readme" \
    | sed -E 's/^- \[([^]]+)\].*/\1/' \
    | sort -u
}

if [[ -n "$ONLY" ]]; then
  PROJECTS=$(echo "$ONLY" | tr ',' '\n' | sort -u)
else
  PROJECTS=$(get_projects)
fi

# Also include sub-products (indented lines)
SUBPRODUCTS=$(grep -E '^  - \[' "$ROOT/README.md" | sed -E 's/^  - \[([^]]+)\].*/\1/' | sort -u)
if [[ -z "$ONLY" ]]; then
  PROJECTS=$(printf '%s\n%s\n' "$PROJECTS" "$SUBPRODUCTS" | sort -u)
fi

repo_dir_for_project() {
  printf '%s\n' "$1"
}

printf '%-20s %-10s %-8s %-8s %s\n' "PROJECT" "BRANCH" "GIT" "CI" "NOTES"
printf '%-20s %-10s %-8s %-8s %s\n' "-------" "------" "---" "--" "-----"

clean=0
dirty=0
ci_red=0
ci_unknown=0
total=0

for project in $PROJECTS; do
  dir="$ROOT/$(repo_dir_for_project "$project")"
  total=$((total + 1))

  if [[ ! -d "$dir/.git" ]]; then
    printf '%-20s %-10s %-8s %-8s %s\n' "$project" "-" "-" "-" "no .git dir"
    continue
  fi

  if [[ "$FETCH" == true ]]; then
    git -C "$dir" fetch --quiet 2>/dev/null || true
  fi

  branch=$(git -C "$dir" branch --show-current 2>/dev/null || echo "DETACHED")

  if [[ -n "$(git -C "$dir" status --porcelain 2>/dev/null)" ]]; then
    git_state="dirty"
    dirty=$((dirty + 1))
  else
    git_state="clean"
    clean=$((clean + 1))
  fi

  # CI check via gh
  ci_state="unknown"
  notes=""
  if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
    url=$(git -C "$dir" remote get-url origin 2>/dev/null || true)
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
        success) ci_state="green" ;;
        failure|cancelled|timed_out|action_required|startup_failure)
          ci_state="red"
          ci_red=$((ci_red + 1))
          notes="CI failing"
          ;;
        none|"")
          ci_state="unknown"
          ci_unknown=$((ci_unknown + 1))
          ;;
        *) ci_state="$conclusion" ;;
      esac
    else
      ci_unknown=$((ci_unknown + 1))
    fi
  else
    ci_unknown=$((ci_unknown + 1))
  fi

  # Check remote sync
  upstream=$(git -C "$dir" rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true)
  if [[ -n "$upstream" ]]; then
    read -r behind ahead < <(git -C "$dir" rev-list --left-right --count "$upstream...HEAD" 2>/dev/null || echo "0 0")
    if [[ "$ahead" -gt 0 ]]; then
      notes="$notes ahead=$ahead"
    fi
    if [[ "$behind" -gt 0 ]]; then
      notes="$notes behind=$behind"
    fi
  fi

  printf '%-20s %-10s %-8s %-8s %s\n' "$project" "$branch" "$git_state" "$ci_state" "$notes"
done

echo ""
echo "Summary: $total projects — $clean clean, $dirty dirty, $ci_red CI-red, $ci_unknown CI-unknown"

if [[ $ci_red -gt 0 ]]; then
  exit 1
fi
