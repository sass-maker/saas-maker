#!/usr/bin/env bash
# Validate the docs corpus.
#
# 1. Source-of-truth internal-link check across docs/ and root *.md.
# 2. Blume build (the real presentation-layer build gate).
#
# We do NOT run `blume validate` here: it only knows the `docs/` route
# space and flags valid cross-tree links to root *.md (e.g. ../AGENTS.md)
# as broken. The python link check is the source-of-truth filesystem
# check; `blume build` proves the presentation layer actually builds.
#
# Run from repo root: `pnpm docs:check` (which calls this script).
# CI runs the same gate in .github/workflows/ci.yml (docs job).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> 1/2  docs internal-link check (scripts/check_docs_links.py)"
python3 scripts/check_docs_links.py

echo "==> 2/2  blume build (docs-site)"
if [ ! -d docs-site/node_modules ]; then
  echo "    docs-site/node_modules missing — installing (pnpm install in docs-site/)"
  (cd docs-site && pnpm install --frozen-lockfile 2>/dev/null || pnpm install)
fi
(cd docs-site && pnpm run build)

echo "==> docs validation OK"
