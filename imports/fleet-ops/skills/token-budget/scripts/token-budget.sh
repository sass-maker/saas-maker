#!/usr/bin/env bash
set -u

target="${1:-$(pwd)}"
codex_home="${CODEX_HOME:-$HOME/.codex}"
fleet_root="/Users/sarthak/Desktop/fleet"

bytes() {
  [ -e "$1" ] && wc -c < "$1" | tr -d ' ' || printf '0'
}

lines() {
  [ -e "$1" ] && wc -l < "$1" | tr -d ' ' || printf '0'
}

status_for_bytes() {
  size="$1"
  high="$2"
  med="$3"
  if [ "$size" -ge "$high" ]; then
    printf 'HIGH'
  elif [ "$size" -ge "$med" ]; then
    printf 'MED'
  else
    printf 'OK'
  fi
}

row() {
  label="$1"
  path="$2"
  high="${3:-32768}"
  med="${4:-8192}"
  size="$(bytes "$path")"
  count="$(lines "$path")"
  state="$(status_for_bytes "$size" "$high" "$med")"
  printf '%-7s %8s B %5s lines  %s\n' "$state" "$size" "$count" "$label"
}

echo "Token Budget Audit"
echo "Target: $target"
echo "Codex home: $codex_home"
echo

echo "Always-loaded / frequently loaded surfaces"
row "global AGENTS" "$codex_home/AGENTS.md" 12000 6000
row "target AGENTS" "$target/AGENTS.md" 12000 6000
row "fleet AGENTS" "$fleet_root/AGENTS.md" 12000 6000
row "memory summary" "$codex_home/memories/memory_summary.md" 20000 10000
row "memory index" "$codex_home/memories/MEMORY.md" 200000 100000
row "config.toml" "$codex_home/config.toml" 20000 10000
echo

echo "Skill footprint"
if [ -d "$codex_home/skills" ]; then
  skill_count="$(find -L "$codex_home/skills" -maxdepth 2 -name SKILL.md | wc -l | tr -d ' ')"
  skill_bytes="$(find -L "$codex_home/skills" -maxdepth 2 -name SKILL.md -print0 | xargs -0 wc -c 2>/dev/null | awk 'END {print $1+0}')"
  printf 'Skills: %s SKILL.md files, %s bytes total\n' "$skill_count" "$skill_bytes"
  find -L "$codex_home/skills" -maxdepth 2 -name SKILL.md -print0 \
    | xargs -0 wc -c 2>/dev/null \
    | sort -nr \
    | head -8
else
  echo "No user skill directory found."
fi
echo

echo "Enabled plugins / MCP hints"
if [ -f "$codex_home/config.toml" ]; then
  awk '
    /^\[plugins\./ { plugin=$0 }
    /^enabled = true/ && plugin { print plugin " " $0 }
    /^\[mcp_servers\./ { print $0 }
    /^model = / || /^model_reasoning_effort = / || /^service_tier = / { print }
  ' "$codex_home/config.toml"
fi
echo

echo "Local cost tools"
for tool in rtk headroom ast-grep sg semgrep repomix gh jq tokei hyperfine; do
  if command -v "$tool" >/dev/null 2>&1; then
    printf 'OK      %s -> %s\n' "$tool" "$(command -v "$tool")"
  else
    printf 'MISSING %s\n' "$tool"
  fi
done
echo

if command -v rtk >/dev/null 2>&1; then
  echo "RTK savings"
  rtk gain 2>/dev/null | sed -n '1,16p'
fi
