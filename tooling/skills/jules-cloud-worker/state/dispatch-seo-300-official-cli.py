#!/usr/bin/env python3
import argparse
import concurrent.futures
import json
import re
import subprocess
import time
from pathlib import Path


STATE_DIR = Path(__file__).resolve().parent
TOPICS_PATH = STATE_DIR / "seo-300-topics-2026-09-19.json"
RESULTS_PATH = STATE_DIR / "seo-300-dispatch-2026-09-19.jsonl"


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


def prompt_for(repo: str, title: str) -> str:
    destination = f"marketing/articles/{product_slug(repo)}/{slugify(title)}.md"
    return f"""Write one evidence-backed SEO article draft titled \"{title}\".

Before writing, read AGENTS.md plus PRODUCT.md and PROJECT_STATUS.md when present. Use current repository evidence as the authority. Create exactly one new Markdown file at `{destination}`.

The draft must include frontmatter for title, slug, target query, search intent, meta title, and meta description; a concise outline; 1200-1800 useful words; concrete examples; internal-link suggestions; a practical next action; and a final non-publishable Source notes section naming the repository files that support product claims and any important limitations.

Treat the target query as an inferred editorial opportunity only. Do not invent keyword volume, difficulty, rankings, traffic, customers, testimonials, outcomes, benchmarks, availability, or comparative superiority. Avoid keyword stuffing, generic AI filler, repeated stock introductions, and unsupported universal claims.

Keep this as a review-only draft. Do not wire routes, change navigation, modify product code, dependencies, lockfiles, configuration, analytics, canonical product definitions, generated files, secrets, environment files, or production files. Run `git diff --check`. Open a pull request containing only this one article draft. Do not merge or publish it."""


def load_completed() -> set[tuple[str, str]]:
    completed: set[tuple[str, str]] = set()
    if not RESULTS_PATH.exists():
        return completed
    for line in RESULTS_PATH.read_text().splitlines():
        if not line.strip():
            continue
        record = json.loads(line)
        if record.get("ok"):
            completed.add((record["repo"], record["title"]))
    return completed


def remaining_items(topic_map: dict[str, list[str]]) -> list[tuple[str, str]]:
    completed = load_completed()
    return [
        (repo, title)
        for repo, titles in topic_map.items()
        for title in titles
        if (repo, title) not in completed
    ]


def active_session_count() -> int:
    result = subprocess.run(
        ["jules", "remote", "list", "--session"],
        check=False,
        text=True,
        capture_output=True,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "unable to list Jules sessions")
    active_markers = (
        "Planning",
        "In Progress",
        "Awaiting Plan A",
        "Awaiting User F",
        "Queued",
        "Paused",
    )
    return sum(
        any(marker in line[-24:] for marker in active_markers)
        for line in result.stdout.splitlines()
    )


def dispatch(item: tuple[str, str]) -> dict[str, object]:
    repo, title = item
    result = subprocess.run(
        ["jules", "new", "--repo", repo, prompt_for(repo, title)],
        check=False,
        text=True,
        capture_output=True,
    )
    combined = "\n".join(part for part in (result.stdout, result.stderr) if part)
    match = re.search(r"^ID:\s*(\d+)\s*$", combined, re.MULTILINE)
    return {
        "repo": repo,
        "title": title,
        "ok": result.returncode == 0 and match is not None,
        "session_id": match.group(1) if match else None,
        "returncode": result.returncode,
        "precondition_blocked": "FAILED_PRECONDITION" in combined,
        "output": combined[-1000:],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--continuous", action="store_true")
    parser.add_argument("--max-active", type=int, default=15)
    parser.add_argument("--poll-seconds", type=int, default=30)
    args = parser.parse_args()

    topic_map = json.loads(TOPICS_PATH.read_text())
    total_succeeded = total_failed = 0
    # Start cautiously because the previous run may have stopped at an account gate.
    # One successful probe immediately restores full slot filling.
    precondition_probe_mode = True

    while True:
        items = remaining_items(topic_map)
        if not items:
            print(
                f"dispatch finished: {total_succeeded} new successes, "
                f"{total_failed} transient failures, 0 topics remaining",
                flush=True,
            )
            return 0

        if args.continuous:
            active = active_session_count()
            slots = max(0, args.max_active - active)
            print(
                f"status active={active} slots={slots} remaining={len(items)} "
                f"probe_mode={precondition_probe_mode}",
                flush=True,
            )
            if slots == 0:
                time.sleep(args.poll_seconds)
                continue
            items = items[:slots]
            if precondition_probe_mode:
                items = items[:1]

        worker_count = min(args.workers, len(items))
        with concurrent.futures.ThreadPoolExecutor(max_workers=worker_count) as executor:
            future_to_item = {executor.submit(dispatch, item): item for item in items}
            batch_succeeded = batch_failed = 0
            batch_precondition_failed = 0
            for future in concurrent.futures.as_completed(future_to_item):
                record = future.result()
                with RESULTS_PATH.open("a") as handle:
                    handle.write(json.dumps(record, ensure_ascii=False) + "\n")
                if record["ok"]:
                    batch_succeeded += 1
                    total_succeeded += 1
                    print(
                        f"OK {total_succeeded:03d} session={record['session_id']} "
                        f"repo={record['repo']} title={record['title']}",
                        flush=True,
                    )
                else:
                    batch_failed += 1
                    total_failed += 1
                    if record["precondition_blocked"]:
                        batch_precondition_failed += 1
                    summary = str(record["output"]).replace("\n", " ")[-300:]
                    print(
                        f"FAIL {total_failed:03d} repo={record['repo']} "
                        f"title={record['title']} error={summary}",
                        flush=True,
                    )

        if batch_succeeded:
            precondition_probe_mode = False
        elif batch_failed and batch_precondition_failed == batch_failed:
            precondition_probe_mode = True

        if not args.continuous:
            print(
                f"dispatch finished: {batch_succeeded} succeeded, "
                f"{batch_failed} failed",
                flush=True,
            )
            return 1 if batch_failed else 0
        if batch_failed and not batch_succeeded:
            time.sleep(args.poll_seconds)


if __name__ == "__main__":
    raise SystemExit(main())
