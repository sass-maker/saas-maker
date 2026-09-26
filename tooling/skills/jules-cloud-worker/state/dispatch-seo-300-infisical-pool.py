#!/usr/bin/env python3
"""Dispatch the remaining SEO campaign through Infisical-backed Jules accounts."""

from __future__ import annotations

import argparse
import concurrent.futures
import importlib.util
import json
import re
import time
from pathlib import Path


STATE_DIR = Path(__file__).resolve().parent
TOPICS_PATH = STATE_DIR / "seo-300-topics-2026-09-19.json"
RESULTS_PATH = STATE_DIR / "seo-300-dispatch-2026-09-19.jsonl"
JULES_IMPL_PATH = STATE_DIR.parent / "scripts" / "jules.py"


def load_jules_impl():
    spec = importlib.util.spec_from_file_location("jules_worker_impl", JULES_IMPL_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"unable to load {JULES_IMPL_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


jules = load_jules_impl()


def slugify(value: str) -> str:
    value = value.lower().replace("vs.", "vs")
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value[:90].rstrip("-")


def product_slug(repo: str) -> str:
    return {
        "Codevetter/codevetter": "codevetter",
        "HeyPace/pace": "pace",
        "PostTrainLLM/posttrainllm": "posttrainllm",
        "Significant-Hobbies/significanthobbies": "significant-hobbies-hub",
        "Significant-Hobbies/swe-interview-prep": "swe-learning-os",
        "Significant-Hobbies/what-it-takes-to-win": "paths",
    }.get(repo, slugify(repo.split("/", 1)[1]))


def destination_for(repo: str, title: str) -> str:
    return f"marketing/articles/{product_slug(repo)}/{slugify(title)}.md"


def prompt_for(repo: str, title: str) -> str:
    destination = destination_for(repo, title)
    return f"""Write one evidence-backed SEO article draft titled \"{title}\".

Before writing, read AGENTS.md plus PRODUCT.md and PROJECT_STATUS.md when present. Use current repository evidence as the authority. Create exactly one new Markdown file at `{destination}`.

The draft must include frontmatter for title, slug, target query, search intent, meta title, and meta description; a concise outline; 1200-1800 useful words; concrete examples; internal-link suggestions; a practical next action; and a final non-publishable Source notes section naming the repository files that support product claims and any important limitations.

Treat the target query as an inferred editorial opportunity only. Do not invent keyword volume, difficulty, rankings, traffic, customers, testimonials, outcomes, benchmarks, availability, or comparative superiority. Avoid keyword stuffing, generic AI filler, repeated stock introductions, and unsupported universal claims.

Keep this as a review-only draft. Do not wire routes, change navigation, modify product code, dependencies, lockfiles, configuration, analytics, canonical product definitions, generated files, secrets, environment files, or production files. Run `git diff --check`. Open a pull request containing only this one article draft. Do not merge or publish it."""


def completed_topics() -> set[tuple[str, str]]:
    completed: set[tuple[str, str]] = set()
    if not RESULTS_PATH.exists():
        return completed
    for line in RESULTS_PATH.read_text().splitlines():
        if not line.strip():
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue
        if row.get("ok") and row.get("session_id"):
            completed.add((row["repo"], row["title"]))
    return completed


def remaining_items(topic_map: dict[str, list[str]]) -> list[tuple[str, str]]:
    completed = completed_topics()
    items = [
        (repo, title)
        for repo, titles in topic_map.items()
        for title in titles
        if (repo, title) not in completed
    ]
    # App Health was blocked on GitHub App access earlier in the campaign.
    # Once authorized, fill its backlog before resuming the original order.
    items.sort(key=lambda item: item[0] != "sass-maker/app-health")
    return items


def repo_contexts(accounts: list[str], repos: set[str]) -> dict[tuple[str, str], tuple[str, str]]:
    conn = jules.db()
    contexts: dict[tuple[str, str], tuple[str, str]] = {}
    for account in accounts:
        for repo in repos:
            row = conn.execute(
                "SELECT source_name, default_branch FROM sources WHERE account=? "
                "AND lower(owner || '/' || repo)=lower(?)",
                (account, repo),
            ).fetchone()
            if not row:
                print(
                    f"source unavailable account={account} repo={repo}",
                    flush=True,
                )
                continue
            contexts[(account, repo)] = (
                row["source_name"],
                row["default_branch"] or "main",
            )
    conn.close()
    return contexts


def active_counts(accounts: list[str]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for account in accounts:
        sessions = jules.api_list(account, "/sessions", "sessions", limit=500)
        counts[account] = sum(
            session.get("state") in jules.ACTIVE_STATES for session in sessions
        )
    return counts


def dispatch_one(
    account: str,
    repo: str,
    title: str,
    context: tuple[str, str],
) -> dict[str, object]:
    source_name, branch = context
    body = {
        "prompt": prompt_for(repo, title),
        "title": title,
        "sourceContext": {
            "source": source_name,
            "githubRepoContext": {"startingBranch": branch},
        },
        "requirePlanApproval": False,
        "automationMode": "AUTO_CREATE_PR",
    }
    try:
        session = jules.api(account, "POST", "/sessions", body)
        return {
            "repo": repo,
            "title": title,
            "ok": bool(session.get("id")),
            "session_id": str(session.get("id")) if session.get("id") else None,
            "account": account,
            "state": session.get("state"),
            "session_name": session.get("name"),
            "created_at": session.get("createTime") or jules.utcnow(),
            "branch": branch,
            "returncode": 0,
            "output": "Infisical-backed Jules API dispatch",
        }
    except jules.QuotaExceeded as exc:
        return {
            "repo": repo,
            "title": title,
            "ok": False,
            "session_id": None,
            "account": account,
            "returncode": 429,
            "output": f"quota exhausted: {exc}",
        }
    except jules.ApiError as exc:
        return {
            "repo": repo,
            "title": title,
            "ok": False,
            "session_id": None,
            "account": account,
            "returncode": exc.status,
            "output": str(exc),
        }


def persist(record: dict[str, object]) -> None:
    with RESULTS_PATH.open("a") as handle:
        handle.write(json.dumps(record, ensure_ascii=False) + "\n")
    if not record.get("ok"):
        return
    repo = str(record["repo"])
    title = str(record["title"])
    destination = destination_for(repo, title)
    conn = jules.db()
    conn.execute(
        """INSERT OR IGNORE INTO tasks
           (account, session_id, session_name, repo, title, fingerprint,
            scope, subsystem, tracked, created_at, status, spec_path)
           VALUES (?,?,?,?,?,?,?,?,1,?,?,?)""",
        (
            record["account"],
            record["session_id"],
            record.get("session_name"),
            repo,
            title,
            jules.fingerprint(title, repo, [destination]),
            json.dumps([destination]),
            "marketing",
            record.get("created_at") or jules.utcnow(),
            record.get("state") or "QUEUED",
            str(TOPICS_PATH),
        ),
    )
    conn.commit()
    conn.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--accounts", nargs="+", default=["B", "C"])
    parser.add_argument("--max-active", type=int, default=60)
    parser.add_argument("--workers", type=int, default=12)
    parser.add_argument("--poll-seconds", type=int, default=60)
    parser.add_argument("--precondition-cooldown-seconds", type=int, default=300)
    parser.add_argument("--max-dispatch-per-account", type=int, default=2)
    args = parser.parse_args()

    topic_map = json.loads(TOPICS_PATH.read_text())
    expected = {(repo, title) for repo, titles in topic_map.items() for title in titles}
    contexts = repo_contexts(args.accounts, set(topic_map))
    # A precondition failure can be specific to a repository's active Jules
    # workload.  Keep other repositories on the same account dispatchable.
    repo_cooldown_until: dict[tuple[str, str], float] = {}

    while True:
        items = remaining_items(topic_map)
        if not items:
            print("dispatch finished: 0 topics remaining", flush=True)
            return 0

        accepted = completed_topics()
        unexpected = accepted - expected
        if unexpected:
            raise RuntimeError(f"ledger contains {len(unexpected)} unexpected topics")

        counts = active_counts(args.accounts)
        now = time.monotonic()
        cooling = {
            account: sum(
                1
                for (cooled_account, _repo), until in repo_cooldown_until.items()
                if cooled_account == account and until > now
            )
            for account in args.accounts
        }
        account_slots = {
            account: (
                min(
                    args.max_dispatch_per_account,
                    max(0, args.max_active - counts[account]),
                )
            )
            for account in args.accounts
        }
        accessible_items = [
            item
            for item in items
            if any((account, item[0]) in contexts for account in args.accounts)
        ]
        inaccessible_repos = sorted(
            {
                repo
                for repo, _title in items
                if not any((account, repo) in contexts for account in args.accounts)
            }
        )
        print(
            f"status active={counts} slots={account_slots} cooling={cooling} "
            f"remaining={len(items)} "
            f"dispatchable={len(accessible_items)} inaccessible_repos={inaccessible_repos}",
            flush=True,
        )
        if not accessible_items or not any(account_slots.values()):
            time.sleep(args.poll_seconds)
            continue

        remaining_slots = account_slots.copy()
        batch: list[tuple[str, tuple[str, str]]] = []
        batch_repos: set[str] = set()
        for repo, title in accessible_items:
            # Spread a small batch across products so one saturated repository
            # cannot consume every attempted slot.
            if repo in batch_repos:
                continue
            eligible = [
                account
                for account in args.accounts
                if (
                    remaining_slots[account] > 0
                    and (account, repo) in contexts
                    and repo_cooldown_until.get((account, repo), 0.0) <= now
                )
            ]
            if not eligible:
                continue
            account = max(
                eligible,
                key=lambda candidate: (
                    remaining_slots[candidate],
                    -args.accounts.index(candidate),
                ),
            )
            batch.append((account, (repo, title)))
            batch_repos.add(repo)
            remaining_slots[account] -= 1

        if not batch:
            time.sleep(args.poll_seconds)
            continue

        succeeded = failed = 0
        with concurrent.futures.ThreadPoolExecutor(
            max_workers=min(args.workers, len(batch))
        ) as executor:
            futures = {
                executor.submit(
                    dispatch_one,
                    account,
                    repo,
                    title,
                    contexts[(account, repo)],
                ): (account, repo, title)
                for account, (repo, title) in batch
            }
            for future in concurrent.futures.as_completed(futures):
                record = future.result()
                persist(record)
                if record["ok"]:
                    succeeded += 1
                    print(
                        f"OK account={record['account']} session={record['session_id']} "
                        f"repo={record['repo']} title={record['title']}",
                        flush=True,
                    )
                else:
                    failed += 1
                    if (
                        record.get("returncode") == 400
                        and "Precondition check failed" in str(record.get("output", ""))
                    ):
                        key = (str(record["account"]), str(record["repo"]))
                        repo_cooldown_until[key] = (
                            time.monotonic() + args.precondition_cooldown_seconds
                        )
                    print(
                        f"FAIL account={record['account']} repo={record['repo']} "
                        f"title={record['title']} error={record['output']}",
                        flush=True,
                    )

        if failed and not succeeded:
            time.sleep(args.poll_seconds)


if __name__ == "__main__":
    raise SystemExit(main())
