#!/usr/bin/env python3
import json
import subprocess
import tempfile
from pathlib import Path


STATE_DIR = Path(__file__).resolve().parent
MANIFEST = STATE_DIR / "seo-articles-2026-09-19.json"
WORKER = STATE_DIR.parent / "bin" / "jules-worker"


def task_spec(item: dict[str, object]) -> dict[str, object]:
    product = str(item["product"])
    topics = list(item["topics"])
    return {
        "repo": item["repo"],
        "branch": "main",
        "title": f"Write an evidence-backed SEO article cluster for {product}",
        "reason": item["reason"],
        "scope": ["marketing/articles/"],
        "subsystem": "marketing-articles",
        "behaviors": [
            f"Write one substantive Markdown draft for each topic: {topics[0]}; {topics[1]}; {topics[2]}",
            "Before writing, read AGENTS.md plus PRODUCT.md and PROJECT_STATUS.md when present; use current repository evidence as the authority",
            "Give every draft a human-readable title, slug, target query, search intent, meta title, meta description, concise outline, internal-link suggestions, and a clear next action",
            "Write 1000-1600 useful words per article in a direct, specific voice; lead with the reader problem and explain the mechanism with concrete examples",
            "End each draft with a non-publishable Source notes section listing the repository files that support product claims and any important limitations",
            "Treat keywords as editorial targets only; do not invent search volume, rankings, traffic, customers, testimonials, outcomes, benchmarks, availability, or comparative superiority",
            "Keep these as review-only drafts under marketing/articles; do not wire routes, change navigation, modify product code, or publish anything",
        ],
        "acceptance": [
            "Exactly three new article drafts exist under marketing/articles in a clearly named product folder when the repository contains multiple products",
            "Every factual product claim is supported by a named repository source or explicitly framed as general guidance or a hypothesis",
            "The articles are materially distinct, avoid keyword stuffing and generic AI filler, and do not repeat the same introduction or structure",
            "No source, generated output, dependency, lockfile, configuration, route, navigation, analytics, credential, deployment, or production file changes",
            "git diff --check passes",
        ],
        "commands": ["git diff --check"],
        "forbidden": [
            "publishing or deployment",
            "product or architecture changes",
            "new dependencies",
            "invented evidence or market metrics",
            "editing secrets, environment files, production configuration, generated files, or existing canonical product definitions",
            "broad formatting or unrelated cleanup",
        ],
        "require_plan_approval": False,
        "automation_mode": "AUTO_CREATE_PR",
    }


def main() -> int:
    items = json.loads(MANIFEST.read_text())
    failures = 0
    with tempfile.TemporaryDirectory(prefix="jules-seo-") as temp_dir:
        temp_path = Path(temp_dir)
        for index, item in enumerate(items, start=1):
            spec_path = temp_path / f"{index:02d}.json"
            spec_path.write_text(json.dumps(task_spec(item), indent=2) + "\n")
            result = subprocess.run(
                [str(WORKER), "dispatch", str(spec_path)],
                check=False,
                text=True,
                capture_output=True,
            )
            print(f"[{index:02d}/{len(items):02d}] {item['repo']}")
            if result.stdout:
                print(result.stdout.rstrip())
            if result.stderr:
                print(result.stderr.rstrip())
            if result.returncode != 0:
                failures += 1
    print(f"dispatch complete: {len(items) - failures} succeeded, {failures} failed")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
