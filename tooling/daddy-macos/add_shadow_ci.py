#!/usr/bin/env python3
"""Add a pinned shadow candidate job while preserving each app's existing CI."""

import argparse
from pathlib import Path
import re
import sys

from check_copies import APPS


def updated_ci(source: str, app: str, tooling_sha: str) -> str:
    if not re.fullmatch(r"[0-9a-f]{40}", tooling_sha):
        raise ValueError("Tooling revision must be a reviewed full commit SHA")
    if app not in APPS or "jobs:\n" not in source or "  test:\n" not in source:
        raise ValueError("Unexpected Daddy app CI workflow")
    job = ("\n  shared_candidate:\n"
           f"    uses: sass-maker/saas-maker/.github/workflows/daddy-macos-candidate.yml@{tooling_sha}\n"
           "    with:\n"
           f"      app: {app}\n"
           f"      tooling-ref: {tooling_sha}\n")
    if "  shared_candidate:\n" in source:
        if job.strip() in source:
            return source
        raise ValueError("Existing shared_candidate job differs; review it manually")
    return source.rstrip() + "\n" + job


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fleet-root", type=Path, required=True)
    parser.add_argument("--tooling-sha", required=True)
    parser.add_argument("--write", action="store_true", help="Write the four app workflows; default only validates")
    args = parser.parse_args()
    updates = []
    try:
        for app in APPS:
            path = args.fleet_root / app / ".github/workflows/ci.yml"
            source = path.read_text()
            updates.append((path, updated_ci(source, app, args.tooling_sha)))
    except (ValueError, OSError) as error:
        print(error, file=sys.stderr)
        return 1
    if args.write:
        for path, content in updates:
            path.write_text(content)
            print(f"Updated {path}")
    else:
        print("Four app CI workflows are ready for a pinned shadow job; pass --write after publishing tooling")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
