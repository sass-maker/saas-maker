#!/usr/bin/env python3
"""Read-only byte-copy check using candidate.SHARED_COPIES (including appcast_core)."""

import argparse
from pathlib import Path
import sys
import re

from candidate import check_shared_copies, profile_for


APPS = ("storagedaddy", "performancedaddy", "browserdaddy", "contextdaddy")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fleet-root", type=Path, required=True)
    args = parser.parse_args()
    revisions = set()
    for app in APPS:
        try:
            repository = f"Significant-Hobbies/{app}"
            profile_for(app, repository)
            root = args.fleet_root / app
            check_shared_copies(app, root)
            ci = (root / ".github/workflows/ci.yml").read_text()
            pins = re.findall(r"daddy-macos-candidate.yml@([0-9a-f]{40})\b", ci)
            if len(pins) != 1:
                raise ValueError(f"Missing immutable foundation pin: {app}")
            revisions.add(pins[0])
        except ValueError as error:
            print(error, file=sys.stderr)
            return 1
        print(f"{app}: shared copies match")
    if len(revisions) != 1:
        print("Daddy app foundation revisions differ", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
