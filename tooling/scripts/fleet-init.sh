#!/usr/bin/env bash
#
# Scaffold a new fleet project — creates GitHub repo, local checkout,
# AGENTS.md, PROJECT_STATUS.md, .gitignore, and CI workflow. The Fleet root is
# not a Git repository; this script never writes or commits there.
# Backs the fleet-init skill.
#
# Usage:
#   bash scripts/fleet-init.sh <name> --owner <org> --category <cat> --desc <desc> --stack <stack> [--private]
#   bash scripts/fleet-init.sh my-project --owner sass-maker --category data --desc "evidence tracker" --stack "Astro + CF Workers"

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
NAME=""
CATEGORY=""
DESC=""
STACK=""
VISIBILITY="--public"
GITHUB_OWNER="${FLEET_GITHUB_OWNER:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --owner) GITHUB_OWNER="$2"; shift 2 ;;
    --category) CATEGORY="$2"; shift 2 ;;
    --desc) DESC="$2"; shift 2 ;;
    --stack) STACK="$2"; shift 2 ;;
    --private) VISIBILITY="--private"; shift ;;
    -h|--help)
      echo "Usage: fleet-init.sh <name> --owner <org> --category <cat> --desc <desc> --stack <stack> [--private]"
      echo "Categories: support, personal, saas, data, research"
      exit 0
      ;;
    *)
      if [[ -z "$NAME" ]]; then
        NAME="$1"
      else
        echo "Unknown arg: $1" >&2; exit 1
      fi
      shift
      ;;
  esac
done

if [[ -z "$NAME" || -z "$GITHUB_OWNER" || -z "$CATEGORY" || -z "$DESC" ]]; then
  echo "Usage: fleet-init.sh <name> --owner <org> --category <cat> --desc <desc> --stack <stack> [--private]" >&2
  echo "Missing required args. Name, owner, category, and desc are required." >&2
  exit 1
fi

DIR="$ROOT/$NAME"

if [[ -d "$DIR" ]]; then
  echo "Directory already exists: $DIR" >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI is required" >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "gh is not authenticated" >&2
  exit 1
fi

echo "=== Creating fleet project: $NAME ==="
echo "Category: $CATEGORY"
echo "Description: $DESC"
echo "Stack: ${STACK:-unspecified}"
echo "Visibility: ${VISIBILITY#--}"
echo ""

# 1. Create GitHub repo and clone
echo "1. Creating GitHub repo $GITHUB_OWNER/$NAME..."
gh repo create "$GITHUB_OWNER/$NAME" $VISIBILITY \
  --description "$DESC" \
  2>/dev/null || {
    echo "  gh repo create failed — repo may already exist" >&2
    exit 1
  }

gh repo clone "$GITHUB_OWNER/$NAME" "$DIR" \
  2>/dev/null || {
    echo "  gh repo clone failed — remote was created but local checkout was not" >&2
    exit 1
  }

cd "$DIR"

# 2. .gitignore
cat > .gitignore <<'GITEOF'
node_modules/
dist/
.env*
.wrangler/
.astro/
.agents/
.claude/
.DS_Store
*.log
*.db
*.db-journal
GITEOF

# 3. AGENTS.md
cat > AGENTS.md <<AGENTSEOF
## Shared Fleet Standard

Also read and follow the shared fleet-level agent standard at \`../AGENTS.md\`. Treat this repository as owned product code: protect production stability, keep changes scoped, verify work, and record durable follow-up tasks when something remains incomplete or blocked.

## Project

- **Stack**: ${STACK:-TBD}
- **Local dev**: TBD
- **Deploy**: TBD

## Visual work

For meaningful visual work, use the Fleet-local \`\$design-workflow\` skill and
the shared \`../LANDING_STANDARD.md\` where applicable. Classify preserve or
overhaul before code; keep \`PROJECT_STATUS.md\` authoritative for product
scope, \`PRODUCT.md\` limited to design context, and \`DESIGN.md\` authoritative
for visual direction. Do not claim completion until the Fleet design-review
receipt passes.
AGENTSEOF

# 4. PROJECT_STATUS.md
cat > PROJECT_STATUS.md <<STATUSEOF
# $NAME — PROJECT STATUS

Last updated: $(date +%Y-%m-%d)

## Why / What

$DESC

**Users:** TBD

**IN scope:** TBD

**OUT of scope:** TBD

## Dependencies

### External

- TBD

### Internal

- TBD

## Timeline

- $(date +%Y-%m-%d) — project scaffolded

## Products

- TBD

## Features (shipped)

- (none yet)

## Todo / Planned / Deferred / Blocked

1. TBD
STATUSEOF

# 5. CI workflow
mkdir -p .github/workflows
cat > .github/workflows/ci.yml <<CIEOF
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm install
      - run: npm run check
CIEOF

# 6. Commit and push initial scaffold
git add -A
git commit -m "Initial scaffold

Generated with [Devin](https://devin.ai)

Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>"
git push origin main 2>/dev/null || true

# Keep Fleet and approved external skills available locally without committing
# machine-specific symlinks into the new repository.
"$ROOT/saas-maker/tooling/scripts/link-project-agent-assets.sh" --skills-only "$NAME"

echo ""
echo "2. Scaffold files committed and pushed."
echo ""

echo ""
echo "=== Done ==="
echo "Project: $NAME"
echo "Repo: https://github.com/$GITHUB_OWNER/$NAME"
echo "Local: $DIR"
echo ""
echo "Post-creation checklist:"
echo "  [ ] AGENTS.md, PROJECT_STATUS.md, .gitignore committed"
echo "  [ ] CI workflow committed (may need adjusting for your stack)"
echo "  [ ] Register in saas-maker catalog/projects.json, then pnpm catalog:sync"
echo "  [ ] If visual: run \$design-workflow and pass the Fleet design-review receipt"
echo "  [ ] If Cloudflare: create wrangler config"
echo "  [ ] If DB: create schema + first migration"
