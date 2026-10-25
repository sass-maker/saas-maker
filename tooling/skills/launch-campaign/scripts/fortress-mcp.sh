#!/usr/bin/env bash
set -euo pipefail

if ! command -v uvx >/dev/null 2>&1; then
  echo 'Fortress directory fallback requires uv (uvx). Use the normal browser or record blocked.' >&2
  exit 1
fi

# Keep this optional directory tool local, lazy, and independent of paid services.
for setting in ${!TILION_@} ${!TILLION_@}; do
  case "$setting" in
    TILION_LICENSE_KEY|TILLION_LICENSE_KEY) ;;
    *) unset "$setting" ;;
  esac
done
unset CAPTCHA_API_KEY CAPTCHA_PROVIDER TURING_ENDPOINT TURING_KEY
export TILION_SELFHEAL=0
export TILLION_SELFHEAL_ENABLED=0
export TILLION_CAPTCHA_PROVIDER=none
export TILION_MCP_PREWARM=0
export TILLION_MCP_PREWARM=0
export TILION_MCP_HEADLESS=1
export TILLION_MCP_HEADLESS=1
export TILION_ALLOW_PRIVATE_EGRESS=0
export TILLION_ALLOW_PRIVATE_EGRESS=0
export TILION_MCP_ALLOW_ANY_PATH=0
export TILLION_MCP_ALLOW_ANY_PATH=0

exec uvx --python 3.12 --from 'tilion[mcp]==0.1.16' \
  --with 'tilion-fortress==153.0.8010.36.post1' tilion-mcp
