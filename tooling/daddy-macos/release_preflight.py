#!/usr/bin/env python3
"""Validate an exact Daddy release tag before any signing or publication."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import subprocess
import sys

from candidate import profile_for
from release_contract import TAG


def git(root: Path, *arguments: str) -> str:
    return subprocess.check_output(["git", "-C", str(root), *arguments], text=True, stderr=subprocess.PIPE).strip()


def inspect_tag(app: str, repository: str, root: Path, tag: str) -> dict:
    profile_for(app, repository)
    match = TAG.fullmatch(tag)
    if match is None or int(match.group(2)) < 1 or str(int(match.group(2))) != match.group(2):
        raise ValueError("Release tag must be v<major>.<minor>.<patch>-<positive build>")
    if git(root, "symbolic-ref", "--short", "HEAD") != "main":
        raise ValueError("Release preflight must run from main")
    if git(root, "status", "--porcelain", "--untracked-files=no"):
        raise ValueError("Release preflight requires a clean tracked checkout")
    source_sha = git(root, "rev-parse", "--verify", f"refs/tags/{tag}^{{commit}}")
    main_sha = git(root, "rev-parse", "HEAD")
    if not re.fullmatch(r"[0-9a-f]{40}", source_sha):
        raise ValueError("Tag does not resolve to a full commit SHA")
    ancestor = subprocess.run(["git", "-C", str(root), "merge-base", "--is-ancestor", source_sha, main_sha], check=False)
    if ancestor.returncode != 0:
        raise ValueError("Release tag commit is not reachable from main")
    if source_sha != main_sha:
        raise ValueError("Release tag must point to the current main commit")
    return {
        "schemaVersion": 1,
        "state": "release-source-preflight-passed",
        "app": app,
        "repository": repository,
        "tag": tag,
        "version": match.group(1),
        "build": int(match.group(2)),
        "sourceSha": source_sha,
        "mainShaAtCheck": main_sha,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--app", required=True)
    parser.add_argument("--repository", required=True)
    parser.add_argument("--root", required=True, type=Path)
    parser.add_argument("--tag", required=True)
    parser.add_argument("--receipt", required=True, type=Path)
    args = parser.parse_args()
    try:
        receipt = inspect_tag(args.app, args.repository, args.root, args.tag)
        args.receipt.parent.mkdir(parents=True, exist_ok=True)
        args.receipt.write_text(json.dumps(receipt, indent=2) + "\n")
        print(args.receipt)
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        print(error, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
