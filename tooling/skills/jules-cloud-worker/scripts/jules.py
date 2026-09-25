#!/usr/bin/env python3
"""jules-worker: manage a small pool of Jules (Google) API accounts as async workers.

Stdlib-only. Optional PyYAML for task specs / config (JSON specs work without it).
See SKILL.md for the operating manual.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import re
import sqlite3
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

BASE = "https://jules.googleapis.com/v1alpha"
ACCOUNTS = ["A", "B", "C"]

SKILL_DIR = Path(__file__).resolve().parent.parent
STATE_DIR = SKILL_DIR / "state"
DEFAULT_DB = STATE_DIR / "jules.sqlite"

ACTIVE_STATES = {
    "QUEUED",
    "PLANNING",
    "AWAITING_PLAN_APPROVAL",
    "AWAITING_USER_FEEDBACK",
    "IN_PROGRESS",
    "PAUSED",
}
TERMINAL_STATES = {"COMPLETED", "FAILED"}
VERDICTS = {"ACCEPT", "REPAIR_ONCE", "REJECT", "HUMAN_REVIEW"}

# Ultra plan limits (see SKILL.md — these are plan-level, not API-returned).
DAILY_TASK_LIMIT = 300
CONCURRENCY_LIMIT = 60
MAX_UNREVIEWED_PRS = 20
MAX_TASKS_PER_REPO_PER_SWEEP = 3
DEDUPE_WINDOW_DAYS = 14

QUOTA_ERROR_HINTS = ("RESOURCE_EXHAUSTED", "quota", "rate limit", "429")


# ---------------------------------------------------------------- secrets


def _resolve_secret(value: str) -> str:
    """Resolve indirect secret references: op://... or keychain:<service>[:<account>]."""
    if value.startswith("op://"):
        out = subprocess.run(
            ["op", "read", value], capture_output=True, text=True
        )
        if out.returncode != 0:
            raise RuntimeError(f"1Password read failed for {value}: {out.stderr.strip()}")
        return out.stdout.strip()
    if value.startswith("keychain:"):
        parts = value.split(":", 2)
        cmd = ["security", "find-generic-password", "-s", parts[1], "-w"]
        if len(parts) == 3 and parts[2]:
            cmd = [
                "security", "find-generic-password",
                "-s", parts[1], "-a", parts[2], "-w",
            ]
        out = subprocess.run(cmd, capture_output=True, text=True)
        if out.returncode != 0:
            raise RuntimeError(f"Keychain read failed for {value}")
        return out.stdout.strip()
    return value


def _load_env_file() -> dict:
    """Load KEY=VALUE pairs from the first .env.local found."""
    candidates = []
    if os.environ.get("JULES_ENV_FILE"):
        candidates.append(Path(os.environ["JULES_ENV_FILE"]))
    candidates += [
        STATE_DIR / ".env.local",
        SKILL_DIR / ".env.local",
        Path.cwd() / ".env.local",
    ]
    for path in candidates:
        if not path.is_file():
            continue
        env = {}
        for line in path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            line = line.removeprefix("export ").strip()
            key, _, val = line.partition("=")
            env[key.strip()] = val.strip().strip('"').strip("'")
        return env
    return {}


def api_key(account: str) -> str | None:
    env_file = _load_env_file()
    raw = os.environ.get(f"JULES_API_KEY_{account}") or env_file.get(
        f"JULES_API_KEY_{account}"
    )
    if not raw:
        return None
    try:
        return _resolve_secret(raw)
    except RuntimeError as exc:
        print(f"warning: account {account}: {exc}", file=sys.stderr)
        return None


# ---------------------------------------------------------------- db


SCHEMA = """
CREATE TABLE IF NOT EXISTS accounts (
  name TEXT PRIMARY KEY,
  state TEXT NOT NULL DEFAULT 'UNKNOWN',
  quota_exhausted_at TEXT,
  sources_fetched_at TEXT
);
CREATE TABLE IF NOT EXISTS sources (
  account TEXT NOT NULL,
  source_name TEXT NOT NULL,
  owner TEXT,
  repo TEXT,
  is_private INTEGER,
  default_branch TEXT,
  fetched_at TEXT,
  PRIMARY KEY (account, source_name)
);
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account TEXT NOT NULL,
  session_id TEXT UNIQUE,
  session_name TEXT,
  repo TEXT,
  title TEXT,
  fingerprint TEXT,
  scope TEXT,
  subsystem TEXT,
  sweep_id INTEGER,
  tracked INTEGER NOT NULL DEFAULT 1,
  created_at TEXT,
  status TEXT,
  pr_url TEXT,
  summary TEXT,
  spec_path TEXT,
  review_result TEXT,
  repair_count INTEGER NOT NULL DEFAULT 0,
  reviewed_at TEXT,
  notes TEXT
);
CREATE TABLE IF NOT EXISTS sweeps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  root TEXT,
  created_at TEXT
);
"""


def utcnow() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def db() -> sqlite3.Connection:
    STATE_DIR.mkdir(exist_ok=True)
    path = Path(os.environ.get("JULES_DB", DEFAULT_DB))
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    for name in ACCOUNTS:
        conn.execute(
            "INSERT OR IGNORE INTO accounts (name, state) VALUES (?, 'UNKNOWN')",
            (name,),
        )
    conn.commit()
    return conn


# ---------------------------------------------------------------- api


class QuotaExceeded(Exception):
    pass


class ApiError(Exception):
    def __init__(self, status: int, body: str):
        super().__init__(f"HTTP {status}: {body[:300]}")
        self.status = status
        self.body = body


def api(account: str, method: str, path: str, body: dict | None = None) -> dict:
    key = api_key(account)
    if not key:
        raise ApiError(0, f"no API key for account {account} (JULES_API_KEY_{account})")
    req = urllib.request.Request(
        BASE + path,
        method=method,
        headers={
            "x-goog-api-key": key,
            "Content-Type": "application/json",
        },
        data=json.dumps(body).encode() if body is not None else None,
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode()
            payload = json.loads(raw) if raw.strip() else {}
            if not isinstance(payload, dict):
                raise ApiError(0, "invalid JSON response: expected an object")
            return payload
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode(errors="replace")
        if exc.code == 429 or any(
            h.lower() in raw.lower() for h in QUOTA_ERROR_HINTS
        ):
            raise QuotaExceeded(raw[:300])
        raise ApiError(exc.code, raw)
    except (urllib.error.URLError, TimeoutError) as exc:
        raise ApiError(0, f"network error: {exc}") from exc
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ApiError(0, f"invalid JSON response: {exc}") from exc


def api_list(account: str, path: str, key_field: str, limit: int = 500) -> list:
    items, token = [], None
    while len(items) < limit:
        sep = "&" if "?" in path else "?"
        page_path = f"{path}{sep}pageSize=100"
        if token:
            page_path += f"&pageToken={token}"
        resp = api(account, "GET", page_path)
        items.extend(resp.get(key_field, []))
        token = resp.get("nextPageToken")
        if not token:
            break
    return items


# ---------------------------------------------------------------- helpers


def norm_repo(repo: str) -> str:
    """Normalize 'owner/repo', 'sources/github/owner/repo', 'github/owner/repo'."""
    repo = repo.strip().removesuffix(".git")
    m = re.search(r"github\.com[:/]([^/]+)/([^/]+)$", repo, re.IGNORECASE)
    if m:
        return f"{m.group(1)}/{m.group(2)}"
    if repo.count("/") == 1:
        return repo
    return repo.split("/")[-2] + "/" + repo.split("/")[-1] if "/" in repo else repo


def subsystem_of(scope: list) -> str:
    """First path component of the first scope entry — the 'subsystem' key."""
    if not scope:
        return ""
    first = scope[0].strip().strip("/")
    return first.split("/")[0] if first else ""


AUDIT_EXCLUDED_DIRS = {
    ".fleet-local",
    ".git",
    ".next",
    "build",
    "coverage",
    "dist",
    "node_modules",
    "out",
}


def discover_test_files(repo_path: Path) -> list[Path]:
    """Find test files while excluding generated/build snapshots."""
    test_files = []
    for pat in (
        "**/*.test.*", "**/*.spec.*", "**/test_*.py", "**/*_test.go",
        "**/tests/**", "**/__tests__/**",
    ):
        for path in repo_path.glob(pat):
            if not path.is_file():
                continue
            relative = path.relative_to(repo_path)
            if any(part in AUDIT_EXCLUDED_DIRS for part in relative.parts[:-1]):
                continue
            test_files.append(path)
    return sorted(set(test_files))


def fingerprint(title: str, repo: str, scope: list) -> str:
    raw = (
        re.sub(r"\s+", " ", title.lower()).strip()
        + "|"
        + norm_repo(repo)
        + "|"
        + ",".join(sorted(s.strip().lower() for s in scope))
    )
    return hashlib.sha1(raw.encode()).hexdigest()[:16]


def tracked_24h(conn: sqlite3.Connection, account: str) -> int:
    cutoff = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=24)).isoformat(
        timespec="seconds"
    )
    row = conn.execute(
        "SELECT COUNT(*) c FROM tasks WHERE account=? AND tracked=1 AND created_at>=?",
        (account, cutoff),
    ).fetchone()
    return row["c"]


def active_count(conn: sqlite3.Connection, account: str) -> int:
    placeholders = ",".join("?" for _ in ACTIVE_STATES)
    row = conn.execute(
        f"SELECT COUNT(*) c FROM tasks WHERE account=? AND status IN ({placeholders})",
        (account, *ACTIVE_STATES),
    ).fetchone()
    return row["c"]


def account_state(conn: sqlite3.Connection, account: str) -> str:
    row = conn.execute(
        "SELECT state FROM accounts WHERE name=?", (account,)
    ).fetchone()
    return row["state"] if row else "UNKNOWN"


def set_account_state(conn: sqlite3.Connection, account: str, state: str) -> None:
    exhausted_at = utcnow() if state == "QUOTA_EXHAUSTED" else None
    conn.execute(
        "UPDATE accounts SET state=?, quota_exhausted_at=COALESCE(?, quota_exhausted_at) WHERE name=?",
        (state, exhausted_at, account),
    )
    conn.commit()


def repo_accessible(conn: sqlite3.Connection, account: str, repo: str) -> bool:
    owner_repo = norm_repo(repo)
    row = conn.execute(
        "SELECT 1 FROM sources WHERE account=? "
        "AND lower(owner || '/' || repo) = lower(?)",
        (account, owner_repo),
    ).fetchone()
    return row is not None


def refresh_account_states(conn: sqlite3.Connection) -> None:
    """Recover QUOTA_EXHAUSTED accounts once the tracked 24h window has room."""
    for account in ACCOUNTS:
        if account_state(conn, account) == "QUOTA_EXHAUSTED" and (
            tracked_24h(conn, account) < DAILY_TASK_LIMIT
        ):
            set_account_state(conn, account, "READY")


def choose_account(conn: sqlite3.Connection, repo: str) -> str | None:
    """Lowest active count, then highest tracked remaining — per SKILL.md routing."""
    candidates = []
    for account in ACCOUNTS:
        if account_state(conn, account) not in ("READY", "UNKNOWN"):
            continue
        if not api_key(account):
            continue
        if not repo_accessible(conn, account, repo):
            continue
        active = active_count(conn, account)
        if active >= CONCURRENCY_LIMIT:
            continue
        remaining = DAILY_TASK_LIMIT - tracked_24h(conn, account)
        if remaining <= 0:
            continue
        candidates.append((active, -remaining, account))
    if not candidates:
        return None
    candidates.sort()
    return candidates[0][2]


def render_prompt(spec: dict) -> str:
    """Deterministic prompt template — never send 'add more tests'."""
    def bullets(key):
        items = spec.get(key) or []
        if isinstance(items, str):
            items = [items]
        return "\n".join(f"- {i}" for i in items) or "- (none specified)"

    return f"""{spec.get('title', 'Untitled task')}

## Why this matters
{spec.get('reason', '(not specified)')}

## Scope — only touch these paths
{bullets('scope')}

## Behaviors to cover
{bullets('behaviors')}

## Acceptance criteria
{bullets('acceptance')}

## Verification commands
{bullets('commands')}

## Forbidden
{bullets('forbidden')}
"""


def load_spec(path: str) -> dict:
    text = Path(path).read_text()
    try:
        import yaml  # type: ignore

        return yaml.safe_load(text)
    except ImportError:
        pass
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        sys.exit(
            "Task spec is YAML but PyYAML is not installed.\n"
            "Either `pip install pyyaml` or write the spec as JSON (valid YAML subset)."
        )


def load_config() -> dict:
    for path in (STATE_DIR / "config.yaml", SKILL_DIR / "config.yaml"):
        if not path.is_file():
            continue
        try:
            import yaml  # type: ignore

            return yaml.safe_load(path.read_text()) or {}
        except ImportError:
            print(
                f"warning: {path} present but PyYAML missing; ignoring",
                file=sys.stderr,
            )
            return {}
    return {}


def upsert_session(conn, account: str, s: dict, tracked: int = 0) -> None:
    pr_url = None
    for out in s.get("outputs") or []:
        pr = out.get("pullRequest")
        if pr and pr.get("url"):
            pr_url = pr["url"]
    existing = conn.execute(
        "SELECT id, tracked, pr_url FROM tasks WHERE session_id=?", (s.get("id"),)
    ).fetchone()
    if existing:
        conn.execute(
            """UPDATE tasks SET status=?, session_name=?,
               pr_url=COALESCE(?, pr_url) WHERE session_id=?""",
            (s.get("state"), s.get("name"), pr_url, s.get("id")),
        )
    else:
        conn.execute(
            """INSERT INTO tasks
               (account, session_id, session_name, repo, title, tracked,
                created_at, status, pr_url)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (
                account,
                s.get("id"),
                s.get("name"),
                None,
                s.get("title"),
                tracked,
                s.get("createTime", utcnow()),
                s.get("state"),
                pr_url,
            ),
        )
    conn.commit()


def fetch_sources(conn: sqlite3.Connection, account: str) -> list:
    sources = api_list(account, "/sources", "sources")
    conn.execute("DELETE FROM sources WHERE account=?", (account,))
    for s in sources:
        gh = s.get("githubRepo") or {}
        default_branch = (gh.get("defaultBranch") or {}).get("displayName")
        conn.execute(
            """INSERT OR REPLACE INTO sources
               (account, source_name, owner, repo, is_private, default_branch, fetched_at)
               VALUES (?,?,?,?,?,?,?)""",
            (
                account,
                s.get("name"),
                gh.get("owner"),
                gh.get("repo"),
                1 if gh.get("isPrivate") else 0,
                default_branch,
                utcnow(),
            ),
        )
    conn.execute(
        "UPDATE accounts SET sources_fetched_at=? WHERE name=?",
        (utcnow(), account),
    )
    conn.commit()
    return sources


# ---------------------------------------------------------------- commands


def cmd_setup(args) -> None:
    conn = db()
    matrix: dict[str, set] = {}
    for account in ACCOUNTS:
        key = api_key(account)
        if not key:
            set_account_state(conn, account, "NO_KEY")
            print(f"Account {account}: no key (set JULES_API_KEY_{account})")
            continue
        try:
            sources = fetch_sources(conn, account)
            set_account_state(conn, account, "READY")
            print(f"Account {account}: authenticated ✓ ({len(sources)} sources)")
        except QuotaExceeded:
            set_account_state(conn, account, "QUOTA_EXHAUSTED")
            print(f"Account {account}: authenticated but quota exhausted")
            sources = []
        except ApiError as exc:
            set_account_state(conn, account, "AUTH_FAILED")
            print(f"Account {account}: FAILED — {exc}")
            continue
        for s in sources:
            gh = s.get("githubRepo") or {}
            name = f"{gh.get('owner','?')}/{gh.get('repo','?')}"
            matrix.setdefault(name, set()).add(account)

    print("\nRepositories:")
    width = max((len(r) for r in matrix), default=4)
    for repo in sorted(matrix):
        flags = " ".join(a if a in matrix[repo] else "-" for a in ACCOUNTS)
        print(f"  {repo:<{width}}  {flags}")

    # Reconcile existing remote sessions so untracked work is visible.
    print("\nReconciling existing sessions:")
    for account in ACCOUNTS:
        if account_state(conn, account) != "READY":
            continue
        try:
            sessions = api_list(account, "/sessions", "sessions", limit=200)
        except ApiError as exc:
            print(f"  {account}: session list failed — {exc}")
            continue
        for s in sessions:
            upsert_session(conn, account, s, tracked=0)
        print(f"  {account}: {len(sessions)} remote sessions recorded")


def cmd_usage(args) -> None:
    conn = db()
    refresh_account_states(conn)
    print(f"{'ACCOUNT':<8}{'CREATED/24H':<14}{'TRACKED LEFT':<15}{'ACTIVE':<9}STATE")
    for account in ACCOUNTS:
        created = tracked_24h(conn, account)
        left = DAILY_TASK_LIMIT - created
        active = active_count(conn, account)
        print(
            f"{account:<8}{created:<14}{left:<15}{active:<9}"
            f"{account_state(conn, account)}"
        )
    print(
        "\nTracked remaining counts only sessions created by this skill.\n"
        "Authoritative quota remaining: unavailable via documented API —\n"
        "tasks created manually elsewhere make this estimate too high."
    )


def cmd_sources(args) -> None:
    conn = db()
    if args.refresh:
        for account in ACCOUNTS:
            if api_key(account):
                try:
                    fetch_sources(conn, account)
                    print(f"{account}: sources refreshed")
                except ApiError as exc:
                    print(f"{account}: refresh failed — {exc}")
    rows = conn.execute(
        "SELECT account, owner || '/' || repo AS name, default_branch, source_name "
        "FROM sources ORDER BY name, account"
    ).fetchall()
    matrix: dict[str, dict] = {}
    for r in rows:
        matrix.setdefault(r["name"], {"branch": r["default_branch"], "accounts": {}})
        matrix[r["name"]]["accounts"][r["account"]] = r["source_name"]
    width = max((len(r) for r in matrix), default=4)
    for repo in sorted(matrix):
        flags = " ".join(
            a if a in matrix[repo]["accounts"] else "-" for a in ACCOUNTS
        )
        print(f"{repo:<{width}}  {flags}   branch={matrix[repo]['branch']}")


def _git(repo_path: Path, *git_args: str) -> str:
    out = subprocess.run(
        ["git", "-C", str(repo_path), *git_args], capture_output=True, text=True
    )
    return out.stdout.strip() if out.returncode == 0 else ""


def detect_framework(repo_path: Path) -> tuple[str, str]:
    """Return (framework, test_command)."""
    pkg = repo_path / "package.json"
    if pkg.is_file():
        try:
            data = json.loads(pkg.read_text())
        except json.JSONDecodeError:
            data = {}
        deps = {
            **(data.get("devDependencies") or {}),
            **(data.get("dependencies") or {}),
        }
        fw = next(
            (f for f in ("vitest", "jest", "mocha", "playwright") if f in deps),
            "node:test",
        )
        test_script = (data.get("scripts") or {}).get("test", "")
        runner = "pnpm" if (repo_path / "pnpm-lock.yaml").exists() else "npm"
        return fw, test_script or f"{runner} test"
    if (repo_path / "pyproject.toml").exists() or (repo_path / "pytest.ini").exists():
        return "pytest", "pytest"
    if (repo_path / "go.mod").exists():
        return "go test", "go test ./..."
    if (repo_path / "Cargo.toml").exists():
        return "cargo test", "cargo test"
    return "unknown", "?"


def cmd_audit(args) -> None:
    conn = db()
    repo_path = Path(args.repo).expanduser().resolve()
    if not (repo_path / ".git").exists():
        sys.exit(f"{repo_path} is not a git repository")

    remote = _git(repo_path, "remote", "get-url", "origin")
    gh_repo = norm_repo(remote) if remote else ""
    fw, test_cmd = detect_framework(repo_path)

    test_files = discover_test_files(repo_path)

    recent = _git(repo_path, "log", "--oneline", "-15")
    todos = _git(repo_path, "grep", "-n", "-E", "TODO|FIXME|HACK").splitlines()[:15]
    status = _git(repo_path, "status", "--porcelain")

    print(f"# Audit: {repo_path.name}")
    print(f"path:        {repo_path}")
    print(f"origin:      {remote or '(none)'}")
    print(f"github repo: {gh_repo or '(unknown — dispatch may not be possible)'}")
    print(f"framework:   {fw}   test cmd: {test_cmd}")
    print(f"test files:  {len(test_files)}")
    for p in test_files[:25]:
        print(f"  - {p.relative_to(repo_path)}")
    if len(test_files) > 25:
        print(f"  ... and {len(test_files) - 25} more")
    print(f"\nrecent commits:\n{recent or '(none)'}")
    print(f"\nTODO/FIXME markers: {len(todos)}")
    for t in todos:
        print(f"  {t}")
    print(f"\nuncommitted changes: {len(status.splitlines()) if status else 0} files")

    if gh_repo:
        eligible = [
            a for a in ACCOUNTS if repo_accessible(conn, a, gh_repo)
        ]
        print(f"\njules access: {' '.join(eligible) if eligible else 'NONE — run sources --refresh or check GitHub connection'}")


def cmd_dispatch(args) -> None:
    conn = db()
    refresh_account_states(conn)
    spec = load_spec(args.task)
    if not isinstance(spec, dict):
        sys.exit("task spec must be a YAML/JSON mapping")
    repo = norm_repo(spec.get("repo", ""))
    if not repo or "/" not in repo:
        sys.exit("task spec needs repo: owner/name")
    title = spec.get("title", "Untitled task")
    scope = spec.get("scope") or []
    subsystem = spec.get("subsystem") or subsystem_of(scope)
    fp = fingerprint(title, repo, scope)

    # Guardrail: review backlog cap.
    unreviewed = conn.execute(
        "SELECT COUNT(*) c FROM tasks WHERE pr_url IS NOT NULL "
        "AND review_result IS NULL AND status='COMPLETED'"
    ).fetchone()["c"]
    if unreviewed >= MAX_UNREVIEWED_PRS and not args.force:
        sys.exit(
            f"refusing: {unreviewed} unreviewed Jules PRs "
            f"(cap {MAX_UNREVIEWED_PRS}). Review the backlog first."
        )

    # Guardrail: per-repo per-sweep cap.
    if args.sweep:
        count = conn.execute(
            "SELECT COUNT(*) c FROM tasks WHERE repo=? AND sweep_id=?",
            (repo, args.sweep),
        ).fetchone()["c"]
        if count >= MAX_TASKS_PER_REPO_PER_SWEEP and not args.force:
            sys.exit(
                f"refusing: {count} tasks already dispatched for {repo} "
                f"in sweep {args.sweep} (cap {MAX_TASKS_PER_REPO_PER_SWEEP})"
            )

    # Guardrail: one active task per subsystem.
    if subsystem and not args.force:
        placeholders = ",".join("?" for _ in ACTIVE_STATES)
        clash = conn.execute(
            f"SELECT session_id, title FROM tasks WHERE repo=? AND subsystem=? "
            f"AND status IN ({placeholders})",
            (repo, subsystem, *ACTIVE_STATES),
        ).fetchone()
        if clash:
            sys.exit(
                f"refusing: active task {clash['session_id']} already touches "
                f"subsystem '{subsystem}' in {repo} ({clash['title']})"
            )

    # Dedupe.
    cutoff = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(
        days=DEDUPE_WINDOW_DAYS)).isoformat(timespec="seconds")
    dup = conn.execute(
        "SELECT session_id, status FROM tasks WHERE fingerprint=? "
        "AND created_at>=? AND status != 'FAILED'",
        (fp, cutoff),
    ).fetchone()
    if dup and not args.force:
        sys.exit(
            f"refusing: near-identical task already dispatched "
            f"({dup['session_id']}, {dup['status']}). Use --force to override."
        )

    prompt = render_prompt(spec)
    plan_approval = bool(spec.get("require_plan_approval", False))
    automation = spec.get("automation_mode", "AUTO_CREATE_PR")

    attempted = []
    while True:
        account = choose_account(conn, repo)
        if not account or account in attempted:
            sys.exit(
                f"no eligible account for {repo} "
                f"(attempted: {', '.join(attempted) or 'none'})"
            )
        attempted.append(account)
        source_name = conn.execute(
            "SELECT source_name FROM sources WHERE account=? "
            "AND lower(owner || '/' || repo) = lower(?)",
            (account, repo),
        ).fetchone()
        if not source_name:
            continue
        branch = spec.get("branch") or conn.execute(
            "SELECT default_branch FROM sources WHERE account=? "
            "AND owner || '/' || repo = ?",
            (account, repo),
        ).fetchone()["default_branch"] or "main"
        body = {
            "prompt": prompt,
            "title": title,
            "sourceContext": {
                "source": source_name["source_name"],
                "githubRepoContext": {"startingBranch": branch},
            },
            "requirePlanApproval": plan_approval,
        }
        if automation:
            body["automationMode"] = automation
        try:
            session = api(account, "POST", "/sessions", body)
            break
        except QuotaExceeded:
            set_account_state(conn, account, "QUOTA_EXHAUSTED")
            print(f"account {account}: quota exhausted — trying next", file=sys.stderr)
            continue
        except ApiError as exc:
            sys.exit(f"dispatch failed on account {account}: {exc}")

    conn.execute(
        """INSERT INTO tasks
           (account, session_id, session_name, repo, title, fingerprint,
            scope, subsystem, sweep_id, tracked, created_at, status, spec_path)
           VALUES (?,?,?,?,?,?,?,?,?,1,?,?,?)""",
        (
            account,
            session.get("id"),
            session.get("name"),
            repo,
            title,
            fp,
            json.dumps(scope),
            subsystem,
            args.sweep,
            session.get("createTime", utcnow()),
            session.get("state"),
            str(Path(args.task).resolve()),
        ),
    )
    conn.commit()
    print(f"dispatched: account={account} session={session.get('id')}")
    print(f"  title:  {title}")
    print(f"  repo:   {repo} (branch {branch})")
    print(f"  url:    {session.get('url', '(pending)')}")
    if plan_approval:
        print("  note:   requirePlanApproval=true — approve via `jules-worker approve`")


def cmd_test_sweep(args) -> None:
    conn = db()
    root = Path(args.path).expanduser().resolve()
    repos = [
        p for p in sorted(root.iterdir())
        if p.is_dir() and (p / ".git").exists()
    ]
    if (root / ".git").exists():
        repos.insert(0, root)
    if not repos:
        sys.exit(f"no git repositories found under {root}")

    cur = conn.execute(
        "INSERT INTO sweeps (root, created_at) VALUES (?,?)",
        (str(root), utcnow()),
    )
    conn.commit()
    sweep_id = cur.lastrowid
    print(f"sweep {sweep_id}: {len(repos)} repos under {root}\n")
    print(
        "For each repo below: read the audit, decide 0-3 high-value missing\n"
        "tests (zero is valid), write task yaml per spec, then dispatch with\n"
        f"  jules-worker dispatch <task.yaml> --sweep {sweep_id}\n"
    )
    for repo_path in repos:
        print("=" * 70)
        try:
            cmd_audit(argparse.Namespace(repo=str(repo_path)))
        except SystemExit:
            pass
        print()


def cmd_poll(args) -> None:
    conn = db()
    refresh_account_states(conn)
    for account in ACCOUNTS:
        if not api_key(account):
            continue
        try:
            sessions = api_list(account, "/sessions", "sessions", limit=200)
        except QuotaExceeded:
            set_account_state(conn, account, "QUOTA_EXHAUSTED")
            print(f"{account}: quota exhausted")
            continue
        except ApiError as exc:
            print(f"{account}: poll failed — {exc}")
            continue
        remote_ids = {s.get("id") for s in sessions}
        for s in sessions:
            upsert_session(conn, account, s)

        # Enrich tracked tasks that just went terminal: PR url + summary.
        placeholders = ",".join("?" for _ in TERMINAL_STATES)
        rows = conn.execute(
            f"SELECT session_id, status, pr_url FROM tasks WHERE account=? "
            f"AND tracked=1 AND status IN ({placeholders}) "
            f"AND (pr_url IS NULL OR summary IS NULL)",
            (account, *TERMINAL_STATES),
        ).fetchall()
        for row in rows:
            sid = row["session_id"]
            if sid not in remote_ids:
                continue
            try:
                detail = api(account, "GET", f"/sessions/{sid}")
            except ApiError:
                continue
            for out in detail.get("outputs") or []:
                pr = out.get("pullRequest")
                if pr and pr.get("url"):
                    conn.execute(
                        "UPDATE tasks SET pr_url=? WHERE session_id=?",
                        (pr["url"], sid),
                    )
            try:
                acts = api_list(
                    account, f"/sessions/{sid}/activities", "activities", 100
                )
            except ApiError:
                acts = []
            summary = next(
                (
                    a.get("agentMessaged", {}).get("agentMessage")
                    for a in reversed(acts)
                    if a.get("agentMessaged")
                ),
                None,
            ) or next(
                (
                    a.get("progressUpdated", {}).get("title")
                    for a in reversed(acts)
                    if a.get("progressUpdated")
                ),
                None,
            )
            if summary:
                conn.execute(
                    "UPDATE tasks SET summary=? WHERE session_id=?",
                    (summary[:2000], sid),
                )
            conn.commit()

    # Report.
    print(f"{'SESSION':<22}{'ACCT':<6}{'REPO':<28}{'STATE':<26}PR")
    rows = conn.execute(
        """SELECT session_id, account, repo, status, pr_url, title FROM tasks
           WHERE status IN ("""
        + ",".join("?" for _ in ACTIVE_STATES)
        + """) OR (status='COMPLETED' AND review_result IS NULL)
           ORDER BY created_at DESC LIMIT 40""",
        tuple(ACTIVE_STATES),
    ).fetchall()
    for r in rows:
        print(
            f"{(r['session_id'] or '?')[:20]:<22}{r['account']:<6}"
            f"{(r['repo'] or '-')[:26]:<28}{r['status']:<26}"
            f"{r['pr_url'] or '-'}"
        )
    awaiting = conn.execute(
        "SELECT session_id, account FROM tasks "
        "WHERE status='AWAITING_PLAN_APPROVAL'"
    ).fetchall()
    for r in awaiting:
        print(
            f"\nplan awaiting approval: {r['session_id']} (account {r['account']}) "
            f"— run `jules-worker approve {r['session_id']}` or reject"
        )


def cmd_review(args) -> None:
    conn = db()
    if args.set:
        if not args.session:
            sys.exit("--set requires --session <id>")
        row = conn.execute(
            "SELECT id, repair_count FROM tasks WHERE session_id=?",
            (args.session,),
        ).fetchone()
        if not row:
            sys.exit(f"unknown session {args.session}")
        if args.set == "REPAIR_ONCE":
            if row["repair_count"] >= 1:
                sys.exit(
                    "repair budget already used for this session — "
                    "escalate to HUMAN_REVIEW"
                )
            if not args.repair:
                sys.exit("REPAIR_ONCE requires --repair '<instructions>'")
            account = conn.execute(
                "SELECT account FROM tasks WHERE session_id=?", (args.session,)
            ).fetchone()["account"]
            api(account, "POST",
                f"/sessions/{args.session}:sendMessage",
                {"prompt": args.repair})
            conn.execute(
                """UPDATE tasks SET review_result=NULL,
                   repair_count=repair_count+1, status='IN_PROGRESS',
                   notes=? WHERE session_id=?""",
                (args.notes, args.session),
            )
            conn.commit()
            print(f"{args.session}: repair instructions sent (1/1 allowed)")
            return
        conn.execute(
            "UPDATE tasks SET review_result=?, reviewed_at=?, notes=? "
            "WHERE session_id=?",
            (args.set, utcnow(), args.notes, args.session),
        )
        conn.commit()
        print(f"{args.session}: {args.set}")
        return

    rows = conn.execute(
        """SELECT session_id, account, repo, title, pr_url, summary, created_at
           FROM tasks WHERE status='COMPLETED' AND review_result IS NULL
           ORDER BY created_at"""
    ).fetchall()
    if not rows:
        print("review queue empty — no completed unreviewed work")
        return
    print(f"{len(rows)} completed session(s) awaiting review:\n")
    for r in rows:
        print(f"session: {r['session_id']}  account={r['account']}  repo={r['repo']}")
        print(f"  title:   {r['title']}")
        print(f"  pr:      {r['pr_url'] or '(no PR created)'}")
        if r["summary"]:
            print(f"  summary: {r['summary'][:300]}")
        print(
            f"  verdict: jules-worker review --session {r['session_id']} "
            "--set ACCEPT|REPAIR_ONCE|REJECT|HUMAN_REVIEW\n"
        )


def cmd_approve(args) -> None:
    conn = db()
    row = conn.execute(
        "SELECT account FROM tasks WHERE session_id=?", (args.session,)
    ).fetchone()
    if not row:
        sys.exit(f"unknown session {args.session}")
    api(row["account"], "POST", f"/sessions/{args.session}:approvePlan", {})
    conn.execute(
        "UPDATE tasks SET status='IN_PROGRESS' WHERE session_id=?",
        (args.session,),
    )
    conn.commit()
    print(f"{args.session}: plan approved")


def cmd_message(args) -> None:
    conn = db()
    row = conn.execute(
        "SELECT account FROM tasks WHERE session_id=?", (args.session,)
    ).fetchone()
    if not row:
        sys.exit(f"unknown session {args.session}")
    api(
        row["account"], "POST",
        f"/sessions/{args.session}:sendMessage",
        {"prompt": args.text},
    )
    print(f"{args.session}: message sent")


def cmd_status(args) -> None:
    conn = db()
    refresh_account_states(conn)
    print("== accounts ==")
    for account in ACCOUNTS:
        print(
            f"  {account}: {account_state(conn, account)} "
            f"(active {active_count(conn, account)}, "
            f"tracked {tracked_24h(conn, account)}/{DAILY_TASK_LIMIT})"
        )
    print("\n== tasks by state ==")
    for r in conn.execute(
        "SELECT status, COUNT(*) c FROM tasks GROUP BY status ORDER BY c DESC"
    ):
        print(f"  {r['status'] or 'DISPATCHED'}: {r['c']}")
    unreviewed = conn.execute(
        "SELECT COUNT(*) c FROM tasks WHERE status='COMPLETED' "
        "AND review_result IS NULL"
    ).fetchone()["c"]
    print(f"\nunreviewed completed: {unreviewed}/{MAX_UNREVIEWED_PRS}")


# ---------------------------------------------------------------- main


def main() -> None:
    p = argparse.ArgumentParser(
        prog="jules-worker",
        description="Pool of Jules API accounts for async bounded coding tasks.",
    )
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("setup", help="verify keys, fetch sources, init state")

    sub.add_parser("usage", help="tracked usage vs plan limits")

    sp = sub.add_parser("sources", help="per-account repo access matrix")
    sp.add_argument("--refresh", action="store_true")

    sp = sub.add_parser("audit", help="mechanical repo brief for test planning")
    sp.add_argument("repo")

    sp = sub.add_parser("dispatch", help="dispatch a task yaml to Jules")
    sp.add_argument("task")
    sp.add_argument("--sweep", type=int, default=None)
    sp.add_argument("--force", action="store_true")

    sp = sub.add_parser("test-sweep", help="audit all repos under a path")
    sp.add_argument("path")

    sub.add_parser("poll", help="reconcile session state, harvest PRs")

    sp = sub.add_parser("review", help="list/record review verdicts")
    sp.add_argument("--session")
    sp.add_argument("--set", dest="set", choices=sorted(VERDICTS))
    sp.add_argument("--repair", help="repair instructions for REPAIR_ONCE")
    sp.add_argument("--notes")

    sp = sub.add_parser("approve", help="approve a pending plan")
    sp.add_argument("session")

    sp = sub.add_parser("message", help="send a message to a session")
    sp.add_argument("session")
    sp.add_argument("text")

    sub.add_parser("status", help="overall state summary")

    args = p.parse_args()
    {
        "setup": cmd_setup,
        "usage": cmd_usage,
        "sources": cmd_sources,
        "audit": cmd_audit,
        "dispatch": cmd_dispatch,
        "test-sweep": cmd_test_sweep,
        "poll": cmd_poll,
        "review": cmd_review,
        "approve": cmd_approve,
        "message": cmd_message,
        "status": cmd_status,
    }[args.cmd](args)


if __name__ == "__main__":
    main()
