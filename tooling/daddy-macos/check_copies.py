#!/usr/bin/env python3
"""Check app-owned copies of canonical Daddy macOS utilities."""

import argparse
from pathlib import Path
import sys

from candidate import check_shared_copies, profile_for


APPS = ("storagedaddy", "performancedaddy", "browserdaddy", "contextdaddy")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fleet-root", type=Path, required=True)
    args = parser.parse_args()
    for app in APPS:
        try:
            profile_for(app, f"sarthakagrawal927/{app}")
            check_shared_copies(app, args.fleet_root / app)
        except ValueError as error:
            print(error, file=sys.stderr)
            return 1
        print(f"{app}: shared copies match")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
