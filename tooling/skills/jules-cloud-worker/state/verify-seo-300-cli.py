#!/usr/bin/env python3
"""Verify the official-CLI SEO campaign ledger against its manifest."""

from __future__ import annotations

import json
from pathlib import Path


STATE = Path(__file__).resolve().parent
BASELINE = STATE / "seo-300-cli-baseline-2026-09-19.json"
MANIFEST = STATE / "seo-300-topics-2026-09-19.json"
LEDGER = STATE / "seo-300-dispatch-2026-09-19.jsonl"
FORBIDDEN_REPOS = {
    "Significant-Hobbies/launchdesk",
    "Significant-Hobbies/ios-landings",
}


def main() -> int:
    baseline = json.loads(BASELINE.read_text())
    manifest = json.loads(MANIFEST.read_text())
    expected = {(repo, title) for repo, titles in manifest.items() for title in titles}

    successful = []
    for line in LEDGER.read_text().splitlines():
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue
        if row.get("session_id"):
            successful.append(row)

    accepted = {(row["repo"], row["title"]): str(row["session_id"]) for row in successful}
    baseline_ids = [str(row["session_id"]) for row in baseline]
    accepted_ids = list(accepted.values())
    all_ids = baseline_ids + accepted_ids
    baseline_repos = {row["repo"] for row in baseline}
    accepted_repos = {repo for repo, _ in accepted}

    report = {
        "expected_cli_tasks": len(baseline) + len(expected),
        "accepted_cli_tasks": len(baseline) + len(accepted),
        "remaining_cli_tasks": len(expected - set(accepted)),
        "manifest_topics": len(expected),
        "accepted_manifest_topics": len(accepted),
        "unique_session_ids": len(set(all_ids)),
        "duplicate_success_rows": len(successful) - len(accepted),
        "unexpected_accepted_topics": len(set(accepted) - expected),
        "forbidden_targets": sorted((baseline_repos | accepted_repos) & FORBIDDEN_REPOS),
    }
    report["complete"] = (
        report["expected_cli_tasks"] == 300
        and report["accepted_cli_tasks"] == 300
        and report["remaining_cli_tasks"] == 0
        and report["unique_session_ids"] == 300
        and report["duplicate_success_rows"] == 0
        and report["unexpected_accepted_topics"] == 0
        and not report["forbidden_targets"]
    )
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0 if report["complete"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
