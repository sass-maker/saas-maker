#!/usr/bin/env python3
"""Fail a macOS release candidate that exits during its first launch."""

from __future__ import annotations

import argparse
from pathlib import Path
import subprocess
import sys
import tempfile


def smoke(app: Path, seconds: float = 4.0) -> None:
    executable = app / "Contents/MacOS" / app.stem
    if not executable.is_file():
        raise ValueError(f"Missing app executable: {executable}")
    with tempfile.TemporaryFile(mode="w+t") as output:
        process = subprocess.Popen([str(executable)], stdout=output, stderr=subprocess.STDOUT)
        try:
            try:
                process.wait(timeout=seconds)
            except subprocess.TimeoutExpired:
                pass
            else:
                output.seek(0)
                raise ValueError(
                    f"Candidate exited during launch (status {process.returncode}):\n"
                    f"{output.read()[-2000:]}"
                )
        finally:
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("app", type=Path)
    args = parser.parse_args()
    try:
        smoke(args.app.resolve())
    except (OSError, ValueError) as error:
        print(error, file=sys.stderr)
        return 1
    print(f"Launch smoke passed: {args.app}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
