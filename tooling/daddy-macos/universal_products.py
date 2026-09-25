#!/usr/bin/env python3
"""Build and verify universal SwiftPM Release products for Daddy app packagers."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import shutil
import stat
import subprocess
import sys

from candidate import profile_for


RESOURCE_BUNDLES = {
    "performancedaddy": "PerformanceDaddy_PerformanceDaddy.bundle",
    "browserdaddy": "BrowserDaddy_BrowserDaddy.bundle",
}
ARCHITECTURES = ("arm64", "x86_64")


def resource_hashes(bundle: Path) -> dict[str, str]:
    if not bundle.is_dir():
        raise ValueError(f"Missing Release resource bundle: {bundle}")
    result = {}
    for path in sorted(bundle.rglob("*")):
        if path.is_symlink():
            raise ValueError(f"Resource bundle symlink is not allowed: {path}")
        if path.is_file():
            result[path.relative_to(bundle).as_posix()] = hashlib.sha256(path.read_bytes()).hexdigest()
    if not result:
        raise ValueError(f"Empty Release resource bundle: {bundle}")
    return result


def architectures(path: Path) -> set[str]:
    if not path.is_file():
        raise ValueError(f"Missing Release executable: {path}")
    return set(subprocess.check_output(["lipo", "-archs", str(path)], text=True).split())


def build_products(root: Path, architecture: str) -> Path:
    triple = f"{architecture}-apple-macosx14.0"
    scratch = root / ".build" / f"daddy-release-{architecture}"
    command = ["swift", "build", "-c", "release", "--triple", triple, "--scratch-path", str(scratch)]
    subprocess.run(command, cwd=root, check=True)
    bin_path = Path(subprocess.check_output(command + ["--show-bin-path"], cwd=root, text=True).strip())
    if bin_path.name != "Release" or not bin_path.is_dir():
        raise ValueError(f"SwiftPM did not produce a Release products directory: {bin_path}")
    return bin_path


def make_universal(app: str, repository: str, root: Path, output: Path) -> dict:
    profile = profile_for(app, repository)
    if app not in RESOURCE_BUNDLES:
        raise ValueError(f"Universal product assembly is not configured for {app}")
    root = root.resolve()
    output = output.resolve()
    if output.name != "Release" or output.exists():
        raise ValueError("Output must be a new directory named Release")
    if not (root / "Package.swift").is_file():
        raise ValueError("Swift package is missing")
    if subprocess.check_output(["git", "status", "--porcelain", "--untracked-files=normal"], cwd=root):
        raise ValueError("Release source has uncommitted files")
    products = {architecture: build_products(root, architecture) for architecture in ARCHITECTURES}
    executable = profile["executable"]
    bundle_name = RESOURCE_BUNDLES[app]
    for architecture, directory in products.items():
        if architectures(directory / executable) != {architecture}:
            raise ValueError(f"Wrong architecture in {directory / executable}")
    arm_bundle = products["arm64"] / bundle_name
    x86_bundle = products["x86_64"] / bundle_name
    hashes = resource_hashes(arm_bundle)
    if hashes != resource_hashes(x86_bundle):
        raise ValueError("Release resource bundles differ between architectures")
    output.mkdir(parents=True, exist_ok=False)
    binary = output / executable
    subprocess.run(["lipo", "-create", str(products["arm64"] / executable),
                    str(products["x86_64"] / executable), "-output", str(binary)], check=True)
    binary.chmod(stat.S_IMODE((products["arm64"] / executable).stat().st_mode))
    if architectures(binary) != set(ARCHITECTURES):
        raise ValueError("Universal Release executable is missing an architecture")
    shutil.copytree(arm_bundle, output / bundle_name)
    source_sha = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip()
    receipt = {
        "schemaVersion": 1,
        "state": "universal-release-products-built",
        "app": app,
        "repository": repository,
        "sourceSha": source_sha,
        "architectures": list(ARCHITECTURES),
        "executable": executable,
        "executableSha256": hashlib.sha256(binary.read_bytes()).hexdigest(),
        "resourceBundle": bundle_name,
        "resourceHashes": hashes,
    }
    (output.parent / "universal-products-receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
    return receipt


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--app", required=True)
    parser.add_argument("--repository", required=True)
    parser.add_argument("--root", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    try:
        print(json.dumps(make_universal(args.app, args.repository, args.root, args.output), indent=2))
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        print(error, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
