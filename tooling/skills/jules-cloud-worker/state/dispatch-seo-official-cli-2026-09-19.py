#!/usr/bin/env python3
import argparse
import json
import subprocess
from pathlib import Path


STATE_DIR = Path(__file__).resolve().parent
MANIFEST = STATE_DIR / "seo-articles-2026-09-19.json"


def prompt(item: dict[str, object]) -> str:
    product = str(item["product"])
    topics = list(item["topics"])
    slug = product.lower().replace(" ", "-")
    return f"""Write three evidence-backed SEO article drafts for {product}.

Topics:
1. {topics[0]}
2. {topics[1]}
3. {topics[2]}

Before writing, read AGENTS.md plus PRODUCT.md and PROJECT_STATUS.md when present. Treat current repository evidence as authoritative. Create exactly three substantive Markdown drafts under marketing/articles/{slug}/. Each draft must include a human-readable title, slug, target query, search intent, meta title, meta description, concise outline, 1000-1600 useful words, internal-link suggestions, a clear next action, and a final non-publishable Source notes section naming supporting repository files and important limitations.

Editorial reason: {item['reason']}

Do not invent search volume, rankings, traffic, customers, testimonials, outcomes, benchmarks, availability, or comparative superiority. Avoid keyword stuffing and generic AI filler; make the articles materially distinct. Keep these as review-only drafts: do not wire routes, change navigation, modify product code, dependencies, lockfiles, configuration, analytics, canonical product definitions, generated files, or production files. Run git diff --check. Open a pull request with only the three drafts. Do not merge or publish it."""


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--start", type=int, required=True, help="zero-based manifest index")
    parser.add_argument("--limit", type=int, default=3)
    args = parser.parse_args()

    items = json.loads(MANIFEST.read_text())
    selected = items[args.start : args.start + args.limit]
    failures = 0
    for index, item in enumerate(selected, start=args.start):
        result = subprocess.run(
            ["jules", "new", "--repo", str(item["repo"]), prompt(item)],
            check=False,
            text=True,
            capture_output=True,
        )
        print(f"[{index:02d}] {item['repo']}")
        if result.stdout:
            print(result.stdout.rstrip())
        if result.stderr:
            print(result.stderr.rstrip())
        if result.returncode != 0:
            failures += 1
    print(f"CLI dispatch complete: {len(selected) - failures} succeeded, {failures} failed")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
