#!/usr/bin/env bash
#
# Deploy readiness gate — verifies a project is safe to deploy before
# allowing the deploy command to run. Backs the fleet-deploy-guard skill.
#
# Usage:
#   bash scripts/fleet-deploy-guard.sh <project>

set -euo pipefail

ROOT="${FLEET_ROOT_OVERRIDE:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
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
PROJECT_DIR="$DIR"

if [[ ! -d "$DIR/.git" ]]; then
  registry="$ROOT/site-health/apps/backend/config/projects.json"
  repo_path=""
  if [[ -d "$ROOT/.git" && -f "$registry" ]] && command -v jq >/dev/null 2>&1; then
    repo_path="$(
      jq -r --arg project "$PROJECT" '
        .projects[]
        | select(.id == $project)
        | .repo // ""
      ' "$registry" 2>/dev/null || true
    )"
  fi

  if [[ -n "$repo_path" && "$repo_path" != /* && "$repo_path" != *".."* &&
    -d "$ROOT/$repo_path" ]]; then
    DIR="$ROOT"
    PROJECT_DIR="$ROOT/$repo_path"
  else
    echo "PROJECT: $PROJECT"
    echo "  ✗ no standalone repo or registered monorepo path for $PROJECT"
    exit 1
  fi
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

read_wrangler_name() {
  local file="$1"
  local name=""
  if [[ "$file" == *.json* ]] && command -v jq >/dev/null 2>&1; then
    name=$(jq -r '.name // empty' "$file" 2>/dev/null || true)
  elif [[ "$file" == *.toml ]]; then
    name=$(grep -E '^\s*name\s*=' "$file" 2>/dev/null | head -1 | sed -E 's/.*=\s*"([^"]+)".*/\1/' || true)
  fi
  # jq intentionally rejects JSONC comments and trailing commas. Wrangler
  # accepts both, so fall back to the top-level name line for JSON configs.
  if [[ -z "$name" && "$file" == *.json* ]]; then
    name=$(sed -nE 's/^[[:space:]]*"name"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' "$file" | head -1)
  fi
  printf '%s' "$name"
}

inspect_push_ci() {
  node - "$1" "$2" "$3" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const [sha, runsInput, workflowsInput] = process.argv.slice(2);
function fail(detail) { console.log(detail); process.exit(1); }
try {
  const pages = JSON.parse(runsInput);
  const workflowPages = JSON.parse(workflowsInput);
  if (!Array.isArray(pages) || !Array.isArray(workflowPages) ||
      pages.some(p => !Array.isArray(p.workflow_runs)) ||
      workflowPages.some(p => !Array.isArray(p.workflows))) {
    fail('unknown: invalid GitHub Actions response');
  }
  const runs = pages.flatMap(p => p.workflow_runs);
  if (pages.some(p => !Number.isSafeInteger(p.total_count) || p.total_count > runs.length) ||
      workflowPages.some(p => !Number.isSafeInteger(p.total_count) ||
        p.total_count > workflowPages.flatMap(page => page.workflows).length)) {
    fail('unknown: incomplete GitHub Actions response');
  }
  const definitions = new Map(workflowPages.flatMap(p => p.workflows).map(w => [w.id, w]));
  const latest = new Map();
  for (const run of runs) {
    if (run.head_sha !== sha || run.head_branch !== 'main' || run.event !== 'push') {
      fail('unknown: GitHub returned non-exact push evidence');
    }
    if (!Number.isSafeInteger(run.workflow_id) || !Number.isSafeInteger(run.id) ||
        !Number.isSafeInteger(run.run_attempt)) fail('unknown: missing workflow/run identity');
    const previous = latest.get(run.workflow_id);
    if (!previous || run.id > previous.id ||
        (run.id === previous.id && run.run_attempt > previous.run_attempt)) {
      latest.set(run.workflow_id, run);
    }
  }
  if (!latest.size) fail(`no push CI for ${sha.slice(0, 8)}`);

  // This is deliberately a narrow source recognizer, not a YAML/shell interpreter.
  // Only literal run steps and simple unquoted commands qualify. Never execute
  // a workflow or package script to discover its meaning. Unknown wrappers,
  // reusable actions and directory-dependent package scripts cannot prove CI.
  function runBlocks(source) {
    const lines = source.split(/\r?\n/);
    const blocks = [];
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^(\s*)(?:-\s+)?run:\s*(.*)$/);
      if (!match) continue;
      const value = match[2].trim();
      const headerIndent = lines[i].search(/run:/);
      if (/^[|>][-+]?$/.test(value)) {
        const block = [];
        while (i + 1 < lines.length) {
          const next = lines[i + 1];
          if (next.trim() && next.search(/\S/) <= headerIndent) break;
          i++; block.push(next.trim());
        }
        blocks.push(block.join('\n'));
      } else blocks.push(value);
    }
    return blocks;
  }
  let scripts = {};
  if (fs.existsSync('package.json')) scripts = JSON.parse(fs.readFileSync('package.json', 'utf8')).scripts || {};
  function validates(command, allowScripts, seen = new Set(), pytestOnly = false) {
    // Reject quoting/comments rather than interpreting an echo containing a
    // convincing-looking command, interpolation, or a commented-out validator.
    if (/["'`#;|<>$\\]/.test(command) || /&/.test(command.replaceAll('&&', ''))) return false;
    if (/[(){}]/.test(command) || /(?:^|&&|\n)\s*(?:if|then|else|elif|fi|for|while|until|do|done|case|esac|exit|return|exec|trap|set|source|eval|command|builtin|\.)(?:\s|$)/.test(command)) return false;
    return command.split(/&&|\n/).some(raw => {
      const line = raw.trim();
      if (/(?:^|\s)(?:--help|--version|-h|-V)(?:\s|$)/.test(line)) return false;
      if (/^(?:uv run )?(?:pytest(?:\s|$)|python(?:3)? -m pytest(?:\s|$))/.test(line)) return true;
      if (pytestOnly) return false;
      if (/^(?:cargo|swift|go) test(?:\s|$)/.test(line) ||
          /^node --test(?:\s|$)/.test(line) ||
          /^(?:vitest|jest)(?:\s|$)/.test(line) ||
          /^(?:astro|vite|next) build(?:\s|$)/.test(line)) return true;
      const invocation = line.match(/^(?:pnpm|npm|yarn) (?:run )?([a-zA-Z0-9:_-]+)(?:\s|$)/);
      if (!allowScripts || !invocation || seen.has(invocation[1])) return false;
      const name = invocation[1];
      return typeof scripts[name] === 'string' && validates(scripts[name], true, new Set([...seen, name]));
    });
  }
  function unconditionalRunBlocks(source) {
    // Recognize only conventional block mappings: jobs at column 0, job ids
    // at 2, job fields at 4, steps at 6 and step fields at 8. Unsupported YAML
    // stays unknown; this is not a general YAML parser or expression evaluator.
    if (/\t|(?:^|\n)\s*<<\s*:|(?:^|\s)[&*][A-Za-z_]/.test(source) ||
        /(?:^|\n)\s*(?:-\s*)?["'][^\n]+["']\s*:/.test(source) ||
        /(?:^|\n)\s*(?:-\s*)?shell\s*:/.test(source)) return [];
    const lines = source.split(/\r?\n/);
    const headers = lines.flatMap((line, i) => /^jobs:\s*(?:#.*)?$/.test(line) ? [i] : []);
    if (headers.length !== 1 || lines.slice(0, headers[0]).some(line => /^defaults\s*:/.test(line))) return [];
    const jobs = [];
    const jobIds = new Set();
    let job;
    for (const line of lines.slice(headers[0] + 1)) {
      if (!line.trim() || line.trimStart().startsWith('#')) continue;
      if (/^\S/.test(line)) break;
      if (/^  \S/.test(line)) {
        job = /^  [A-Za-z_][A-Za-z0-9_-]*:\s*(?:#.*)?$/.test(line) ? [] : null;
        if (job) {
          const id = line.trim().split(':')[0];
          if (jobIds.has(id)) return [];
          jobIds.add(id); jobs.push(job);
        }
      } else if (job) job.push(line);
    }
    const eligible = [];
    for (const body of jobs) {
      // A dependency can implicitly skip a job even without an explicit if.
      if (body.some(line => /^    (?:if|continue-on-error|needs|strategy|uses)\s*:/.test(line))) continue;
      // Only this literal defaults mapping is understood. Directory-scoped
      // jobs can prove direct pytest, never scripts from the root package.json.
      const defaults = body.flatMap((line, i) => /^    defaults\s*:/.test(line) ? [i] : []);
      let jobDirectory = false;
      if (defaults.length) {
        if (defaults.length !== 1) continue;
        const start = defaults[0];
        let end = start + 1;
        while (end < body.length && !/^    \S/.test(body[end])) end++;
        const mapping = body.slice(start, end);
        if (mapping.length !== 3 || !/^    defaults:\s*$/.test(mapping[0]) ||
            !/^      run:\s*$/.test(mapping[1]) ||
            !/^        working-directory:\s*[A-Za-z0-9_./-]+\s*$/.test(mapping[2])) continue;
        jobDirectory = true;
      }
      const starts = body.flatMap((line, i) => /^    steps:\s*(?:#.*)?$/.test(line) ? [i] : []);
      if (starts.length !== 1) continue;
      const steps = [];
      let step;
      for (const line of body.slice(starts[0] + 1)) {
        if (/^ {0,4}\S/.test(line)) break;
        if (/^      - /.test(line)) { step = []; steps.push(step); }
        else if (!/^        /.test(line)) { step = null; continue; }
        if (step) step.push(line);
      }
      for (const block of steps) {
        if (block.some(line => /^(?:      - |        )(?:if|continue-on-error|uses)\s*:/.test(line))) continue;
        const directories = block.filter(line => /^(?:      - |        )working-directory\s*:/.test(line));
        if (directories.length > 1 || directories.some(line =>
            !/^(?:      - |        )working-directory:\s*[A-Za-z0-9_./-]+\s*$/.test(line))) continue;
        const directoryScoped = jobDirectory || directories.length === 1;
        const commands = runBlocks(block.join('\n'));
        if (commands.length === 1) eligible.push({ command: commands[0], directoryScoped });
      }
    }
    return eligible;
  }
  let validationCount = 0;
  for (const run of latest.values()) {
    const definition = definitions.get(run.workflow_id);
    if (!definition || definition.state !== 'active') fail(`unknown: workflow ${run.workflow_id} missing or disabled`);
    const file = definition.path;
    if (typeof file !== 'string' || !/^\.github\/workflows\/[^/]+\.ya?ml$/.test(file) || file.includes('..')) {
      fail(`unknown: workflow ${run.workflow_id} has no local source identity`);
    }
    if (run.status !== 'completed' || run.conclusion !== 'success') {
      fail(`${file}: ${run.status || 'unknown'}/${run.conclusion || 'none'} (run ${run.id})`);
    }
    const source = fs.readFileSync(path.resolve(file), 'utf8');
    if (unconditionalRunBlocks(source).some(block =>
        validates(block.command, !block.directoryScoped, new Set(), block.directoryScoped))) validationCount++;
  }
  if (!validationCount) fail('unknown: no successful source-backed build/test push workflow');
  console.log(`green for ${sha.slice(0, 8)}: ${latest.size} push workflows, ${validationCount} build/test definitions`);
} catch {
  fail('unknown: could not inspect exact-source CI definitions');
}
NODE
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

# 4. CI green for the exact main commit?
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
      head_sha=$(git rev-parse HEAD 2>/dev/null || true)
      # Query every exact-source push run, not whichever workflow finished last.
      # Slurped pagination prevents a later page from hiding pending/red CI.
      if ! command -v node >/dev/null 2>&1; then
        ci_result="fail"; ci_detail="unknown: node is required to inspect CI evidence"
      elif ! runs_json=$(gh api --paginate --slurp \
        "repos/$slug/actions/runs?branch=main&head_sha=$head_sha&event=push&per_page=100" 2>/dev/null) ||
        ! workflows_json=$(gh api --paginate --slurp \
          "repos/$slug/actions/workflows?per_page=100" 2>/dev/null); then
        ci_result="fail"; ci_detail="unknown: GitHub Actions query failed"
      elif ci_detail=$(inspect_push_ci "$head_sha" "$runs_json" "$workflows_json"); then
        ci_result="ok"
      else
        ci_result="fail"
      fi
    else
      ci_result="fail"; ci_detail="no GitHub remote"
    fi
  else
    ci_result="fail"; ci_detail="gh not available"
  fi

  check "CI" "$ci_result" "$ci_detail"
fi

# 5. Cloudflare target known?
# Check root first, then subdirectories (monorepo support)
cf_target=""
for f in "$PROJECT_DIR/wrangler.toml" "$PROJECT_DIR/wrangler.jsonc" "$PROJECT_DIR/wrangler.json"; do
  if [[ -f "$f" ]]; then
    cf_target=$(read_wrangler_name "$f")
    [[ -n "$cf_target" ]] && break
  fi
done

# If not at root, check one level deep (monorepo: workers/, apps/, etc.)
if [[ -z "$cf_target" ]]; then
  while IFS= read -r -d '' f; do
    cf_target=$(read_wrangler_name "$f")
    [[ -n "$cf_target" ]] && break
  done < <(find "$PROJECT_DIR" -maxdepth 3 -name "wrangler.*" -not -path '*/node_modules/*' -print0 2>/dev/null)
  [[ -n "$cf_target" ]] && cf_target="$cf_target (subdir)"
fi

if [[ -z "$cf_target" && -f "$PROJECT_DIR/package.json" && "$(command -v node || true)" ]]; then
  deploy_script=$(node -e "const p=require(process.argv[1]); process.stdout.write(p.scripts?.deploy || '')" "$PROJECT_DIR/package.json" 2>/dev/null || true)
  if [[ "$deploy_script" == *"wrangler pages deploy"* ]]; then
    cf_target=$(printf '%s\n' "$deploy_script" | sed -nE 's/.*--project-name[= ]([^ ]+).*/\1/p' | head -1)
    [[ -z "$cf_target" ]] && cf_target="package deploy script"
  elif [[ "$deploy_script" == *"manual-deploy"* ]]; then
    cf_target="package manual deploy script"
  fi
fi

# Some products keep a standalone Pages site below the repository root (for
# example, pace/website). Recognize the same guarded deploy scripts there.
if [[ -z "$cf_target" && "$(command -v node || true)" ]]; then
  while IFS= read -r -d '' package_file; do
    deploy_script=$(node -e '
      const fs = require("node:fs");
      const file = process.argv[1];
      const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
      process.stdout.write(pkg.scripts?.deploy || "");
    ' "$package_file" 2>/dev/null || true)
    if [[ "$deploy_script" == *"wrangler pages deploy"* ]]; then
      cf_target=$(printf '%s\n' "$deploy_script" | sed -nE 's/.*--project-name[= ]([^ ]+).*/\1/p' | head -1)
      [[ -z "$cf_target" ]] && cf_target="package deploy script"
      cf_target="$cf_target (subdir)"
      break
    elif [[ "$deploy_script" == *"manual-deploy"* ]]; then
      cf_target="package manual deploy script (subdir)"
      break
    fi
  done < <(find "$PROJECT_DIR" -maxdepth 2 -name package.json -not -path "$PROJECT_DIR/package.json" -not -path '*/node_modules/*' -print0 2>/dev/null)
fi

if [[ -z "$cf_target" && -f "$ROOT/site-health/apps/backend/config/projects.json" ]] &&
  command -v jq >/dev/null 2>&1; then
  cf_target="$(
    jq -r --arg project "$PROJECT" '
      .projects[]
      | select(.id == $project and .status == "live")
      | if ((.deployTargets // []) | length) > 0 then
          [.deployTargets[].name] | join(", ")
        else
          .cfProject // ""
        end
  ' "$ROOT/site-health/apps/backend/config/projects.json" 2>/dev/null || true
  )"
  [[ -n "$cf_target" ]] && cf_target="$cf_target (registry)"
fi

if [[ -n "$cf_target" ]]; then
  check "CF target" "ok" "$cf_target"
else
  check "CF target" "fail" "no wrangler config found"
fi

# 6. Operational work lives in GitHub Issues. The guard intentionally does not
# reconstruct a second task database from PROJECT_STATUS.md. A future GitHub
# integration can make labelled release blockers a machine gate.
check "Work queue" "ok" "GitHub Issues are authoritative; review linked blockers"

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
