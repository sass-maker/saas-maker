#!/bin/bash

# --- Foundry Agent Hook ---
# Purpose: Briefs agents entering a Foundry-managed repository.
# Usage: Add to ~/.claude/hooks or shell profile.

CWD=$(pwd)
CONFIG="foundry.json"
LEGACY_CONFIG=".saasmaker.json"

if [ -f "$CWD/$CONFIG" ] || [ -f "$CWD/$LEGACY_CONFIG" ]; then
  PROJECT_NAME=$(basename "$CWD")
  
  echo ""
  echo "⚒️  FOUNDRY SYSTEM DETECTED: $PROJECT_NAME"
  echo "------------------------------------------------"
  echo "This repository is an industrialized unit of the Foundry Software Factory."
  echo ""
  echo "📋 OPERATIONAL PROTOCOLS:"
  if [ -f "AGENTS.md" ]; then
    echo "  - HIGH PRIORITY: Read ./AGENTS.md before making changes."
  fi
  echo "  - STANDARDS: ESLint, TSConfig, and Prettier are shared via @saas-maker/tooling."
  echo "  - MONITORING: Use local PostHog capture in workers/api/src/lib/telemetry.ts (or project-local telemetry.ts)."
  echo "  - VALIDATION: You MUST run 'fnd audit' before concluding your task."
  echo ""
  
  # Run a quick silent audit
  if command -v fnd &> /dev/null; then
    COMPLIANCE=$(fnd audit --raw 2>/dev/null | grep -o '"status":"fail"' | wc -l)
    if [ "$COMPLIANCE" -gt 0 ]; then
      echo "⚠️  WARNING: Project is currently NON-COMPLIANT ($COMPLIANCE failures)."
      echo "    Run 'fnd audit' for details. Fix standards before adding features."
    else
      echo "✅ STATUS: Project is Foundry-Compliant."
    fi
  fi
  echo "------------------------------------------------"
  echo ""
fi
