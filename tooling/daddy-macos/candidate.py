#!/usr/bin/env python3
"""Run the credential-free Daddy macOS candidate checks for one caller repo."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys


PROFILES = Path(__file__).with_name("profiles.json")
FIELDS = {"repository", "executable", "bundleId", "testArguments", "sparkleTests", "workerTests", "developerDir", "updateMode", "updateBaseUrl"}
SHARED_COPIES = {
    "storagedaddy": [("prepare-memory-pack.py", "scripts/prepare-memory-pack.py"), ("sparkle_core.py", "scripts/sparkle_core.py")],
    "performancedaddy": [("worker-core.mjs", "site/worker-core.mjs"), ("sparkle_core.py", "scripts/sparkle_core.py")],
    "browserdaddy": [("worker-core.mjs", "site/worker-core.mjs"), ("sparkle_core.py", "scripts/sparkle_core.py")],
    "contextdaddy": [("prepare-memory-pack.py", "scripts/prepare-memory-pack.py")],
}


def profile_for(app: str, repository: str, profiles_path: Path = PROFILES) -> dict:
    document = json.loads(profiles_path.read_text())
    if set(document) != {"schemaVersion", "apps"} or document["schemaVersion"] != 1:
        raise ValueError("Unsupported Daddy app profile document")
    apps = document["apps"]
    if set(apps) != {"storagedaddy", "performancedaddy", "browserdaddy", "contextdaddy"}:
        raise ValueError("Daddy app profile allowlist changed")
    if app not in apps:
        raise ValueError(f"Unknown Daddy app: {app}")
    profile = apps[app]
    if set(profile) != FIELDS:
        raise ValueError(f"Unexpected profile fields for {app}")
    if profile["repository"] != repository:
        raise ValueError(f"Wrong repository for {app}: {repository}")
    if not all(isinstance(profile[key], bool) for key in ("sparkleTests", "workerTests")):
        raise ValueError(f"Invalid test switches for {app}")
    if profile["testArguments"] not in ([], ["--skip", "DesignSnapshotTests"]):
        raise ValueError(f"Unsupported Swift test arguments for {app}")
    if profile["updateMode"] not in ("sparkle", "manual"):
        raise ValueError(f"Unsupported update mode for {app}")
    update_url = profile["updateBaseUrl"]
    if profile["updateMode"] == "sparkle" and (not isinstance(update_url, str) or not update_url.startswith("https://") or not update_url.endswith("/updates/")):
        raise ValueError(f"Invalid update URL for {app}")
    if profile["updateMode"] == "manual" and update_url is not None:
        raise ValueError(f"Manual update mode must not have an update URL for {app}")
    if profile["developerDir"] is not None and not isinstance(profile["developerDir"], str):
        raise ValueError(f"Invalid developer directory for {app}")
    for key in ("executable", "bundleId"):
        if not isinstance(profile[key], str) or not profile[key]:
            raise ValueError(f"Invalid {key} for {app}")
    return profile


def check_shared_copies(app: str, root: Path, shared_root: Path = Path(__file__).with_name("shared")) -> None:
    for source_name, relative_path in SHARED_COPIES[app]:
        source = shared_root / source_name
        copy = root / relative_path
        if not copy.is_file():
            raise ValueError(f"Missing shared Daddy utility copy: {relative_path}")
        if hashlib.sha256(source.read_bytes()).digest() != hashlib.sha256(copy.read_bytes()).digest():
            raise ValueError(f"Shared Daddy utility drift: {relative_path}")


def run_candidate(app: str, repository: str, root: Path, receipt: Path) -> None:
    profile = profile_for(app, repository)
    root = root.resolve()
    if not (root / "Package.swift").is_file() or not (root / ".github/workflows/ci.yml").is_file():
        raise ValueError(f"Missing Swift package or CI workflow in {root}")
    check_shared_copies(app, root)
    env = os.environ.copy()
    developer_dir = profile["developerDir"]
    if developer_dir is not None:
        if not Path(developer_dir).is_dir():
            raise ValueError(f"Required Xcode path is unavailable: {developer_dir}")
        env["DEVELOPER_DIR"] = developer_dir
    steps = [["swift", "test", *profile["testArguments"]], ["swift", "build", "-c", "release"]]
    if profile["sparkleTests"]:
        steps.append([sys.executable, "-m", "unittest", "test_sparkle_support"])
    if profile["workerTests"]:
        steps.append(["node", "--test", "worker.test.mjs"])
    for command in steps:
        cwd = root / ("scripts" if "test_sparkle_support" in command else "site" if "worker.test.mjs" in command else "")
        if not cwd.is_dir():
            raise ValueError(f"Required test directory is absent: {cwd}")
        print(f"Checking {app}: {' '.join(command)}", flush=True)
        subprocess.run(command, cwd=cwd, env=env, check=True)
    binary = root / ".build/release" / profile["executable"]
    if not binary.is_file():
        raise ValueError(f"Release executable is missing after a successful build: {binary}")
    source_sha = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip()
    swift_version = subprocess.check_output(["swift", "--version"], cwd=root, env=env, text=True).strip()
    receipt.parent.mkdir(parents=True, exist_ok=True)
    receipt.write_text(json.dumps({
        "schemaVersion": 1,
        "state": "candidate-build-passed",
        "app": app,
        "repository": repository,
        "sourceSha": source_sha,
        "swiftVersion": swift_version,
        "executable": profile["executable"],
        "buildBinarySha256": hashlib.sha256(binary.read_bytes()).hexdigest(),
        "updateMode": profile["updateMode"],
        "checks": [" ".join(command) for command in steps],
    }, indent=2) + "\n")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--app", required=True)
    parser.add_argument("--repository", required=True)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--receipt", type=Path, required=True)
    args = parser.parse_args()
    try:
        run_candidate(args.app, args.repository, args.root, args.receipt)
    except (ValueError, subprocess.CalledProcessError) as error:
        print(error, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
