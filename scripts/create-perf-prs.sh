#!/bin/bash
# Create PRs for all perf branches that have been pushed.
# Run this from your terminal (not the Devin sandbox) since gh needs direct TLS access.
#
# Usage: bash fleet-ops/scripts/create-perf-prs.sh

set -e

declare -A PRS=(
  ["truehire"]="perf/fix-verification-scan-and-indexes|perf: fix verification scan + add indexes|Fix N+1 verification queries, add composite indexes on verifications and ratings tables. 10-50X faster admin dashboard."
  ["significanthobbies"]="perf/fix-n1-queries-and-caching|perf: fix N+1 like-counts + add caching|Batch like-count queries, add edge cache for public pages, add DB indexes."
  ["everythingrated"]="perf/fix-ratings-full-scan|perf: fix ratings full-scan + add index|Replace full-table scan with indexed lookup, add composite index on ratings."
  ["research-papers"]="perf/vector-index-and-caching|perf: vector index + caching fixes|Add vector index for similarity search, fix Cache-Control header (private not public), add edge cache."
  ["verified-bases"]="perf/cache-pooling-indexes|perf: cache headers, async emails, HTTP client reuse, intent index|Add Pages _headers cache, fire-and-forget emails, shared HTTP client singletons, orders(intent_id) index."
)

for repo in "${!PRS[@]}"; do
  IFS='|' read -r branch title body <<< "${PRS[$repo]}"
  dir="/Users/sarthak/Desktop/fleet/$repo"
  if [ ! -d "$dir" ]; then
    echo "SKIP: $repo (directory not found)"
    continue
  fi
  cd "$dir"
  if git show-ref --verify --quiet "refs/remotes/origin/$branch"; then
    echo "Creating PR for $repo ($branch)..."
    gh pr create --title "$title" --body "$body

Generated with [Devin](https://devin.ai)" 2>&1 || echo "  (may already exist)"
  else
    echo "SKIP: $repo (branch $branch not found on remote)"
  fi
done

echo ""
echo "=== Checking for new perf branches from running agents ==="
for d in /Users/sarthak/Desktop/fleet/*/; do
  repo=$(basename "$d")
  cd "$d" 2>/dev/null || continue
  git remote get-url origin 2>/dev/null | grep -q sarthak-fleet || continue
  git fetch --quiet origin 2>/dev/null
  for branch in $(git branch -r 2>/dev/null | grep "perf/" | grep -v "HEAD" | sed 's|  origin/||'); do
    if [[ -z "${PRS[$repo]+_}" ]] || [[ "$branch" != "${PRS[$repo]%%|*}" ]]; then
      echo "NEW BRANCH: $repo / $branch"
      echo "  Run: cd $d && gh pr create --title 'perf: ...' --body '...' --base main --head $branch"
    fi
  done
done
