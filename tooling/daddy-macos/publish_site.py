#!/usr/bin/env python3
"""Stage one qualified Daddy release for its existing Cloudflare Worker site.

This is a credential-free file operation. The app-owned protected workflow runs
Wrangler and checks the live result after this script succeeds.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import shutil
import sys

from candidate import profile_for
from release_contract import sha256_file, validate_appcast


LAYOUT = {
    "storagedaddy": {
        "download": "https://storage.daddyrad.com/download",
        "dmg_dirs": ("storagedaddy/releases", "storagedaddy/updates"),
        "feed": "storagedaddy/updates/appcast.xml",
        "sums": "storagedaddy/releases/SHA256SUMS",
    },
    "performancedaddy": {
        "download": "https://performance.daddyrad.com/download",
        "dmg_dirs": ("updates",),
        "feed": "updates/appcast.xml",
    },
    "browserdaddy": {
        "download": "https://browser.daddyrad.com/download",
        "dmg_dirs": ("updates",),
        "feed": "updates/appcast.xml",
    },
    "contextdaddy": {
        "download": "https://context.daddyrad.com/download",
        "dmg_dirs": ("downloads",),
    },
}


def expected_filename(app: str, version: str, build: int) -> str:
    if app == "contextdaddy":
        return f"ContextDaddy-{version}-{build}-arm64.dmg"
    architecture = "arm64" if app == "storagedaddy" else "universal"
    return f"{app}-{version}-build{build}-{architecture}.dmg"


def stage(app: str, repository: str, site: Path, dmg: Path, receipt_path: Path,
          feed: Path | None = None, sums: Path | None = None) -> dict:
    profile = profile_for(app, repository)
    layout = LAYOUT[app]
    receipt = json.loads(receipt_path.read_text())
    if receipt.get("state") != "release-metadata-validated" or receipt.get("app") != app or receipt.get("repository") != repository:
        raise ValueError("Qualified release receipt identity mismatch")
    version, build, source_sha = receipt.get("version"), receipt.get("build"), receipt.get("sourceSha")
    if not isinstance(version, str) or not re.fullmatch(r"\d+\.\d+\.\d+", version):
        raise ValueError("Invalid qualified version")
    if not isinstance(build, int) or isinstance(build, bool) or build < 1:
        raise ValueError("Invalid qualified build")
    if not isinstance(source_sha, str) or not re.fullmatch(r"[0-9a-f]{40}", source_sha):
        raise ValueError("Invalid qualified source SHA")
    if not dmg.is_file() or dmg.name != expected_filename(app, version, build) or sha256_file(dmg) != receipt.get("dmgSha256"):
        raise ValueError("DMG does not match qualified receipt")
    if receipt.get("updateMode") != profile["updateMode"]:
        raise ValueError("Update mode differs from app profile")
    if profile["updateMode"] == "sparkle":
        if feed is None:
            raise ValueError("Sparkle release requires its qualified feed")
        validate_appcast(feed, dmg, version, build, profile["updateBaseUrl"])
    elif feed is not None:
        raise ValueError("Manual release cannot publish a Sparkle feed")
    if app == "storagedaddy":
        if sums is None or sums.read_text() != f"{receipt['dmgSha256']}  {dmg.name}\n":
            raise ValueError("StorageDaddy requires matching qualified checksums")

    manifest_path = site / "release.json"
    previous = json.loads(manifest_path.read_text())
    old_build = previous.get("build")
    if not isinstance(old_build, int) or isinstance(old_build, bool):
        raise ValueError("Existing site manifest has no valid build")
    if build < old_build or (build == old_build and previous.get("sha256") != receipt["dmgSha256"]):
        raise ValueError("Release would replace a newer or different published build")

    if app == "storagedaddy":
        manifest = {
            "version": f"{version}-beta", "filename": dmg.name,
            "path": f"/storagedaddy/releases/{dmg.name}", "sha256": receipt["dmgSha256"],
            "ready": True, "bytes": dmg.stat().st_size, "notarized": True,
            "build": build, "sourceSha": source_sha,
        }
    elif app == "contextdaddy":
        manifest = {
            "version": version, "build": build, "filename": dmg.name,
            "path": f"/downloads/{dmg.name}", "sha256": receipt["dmgSha256"],
            "bytes": dmg.stat().st_size, "sourceSha": source_sha,
        }
    else:
        manifest = {
            "app": app, "version": version, "build": build,
            "sourceSha": source_sha, "filename": dmg.name,
            "sha256": receipt["dmgSha256"], "bytes": dmg.stat().st_size,
            "baseUrl": profile["updateBaseUrl"],
        }

    public = site / "public"
    for directory in layout["dmg_dirs"]:
        target = public / directory / dmg.name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(dmg, target)
    if feed is not None:
        target = public / layout["feed"]
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(feed, target)
    if app == "storagedaddy":
        target = public / layout["sums"]
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(sums, target)
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    return {
        "app": app, "version": version, "build": build, "sourceSha": source_sha,
        "dmgSha256": receipt["dmgSha256"], "downloadUrl": layout["download"],
        "updateUrl": profile["updateBaseUrl"] + dmg.name if feed is not None else None,
        "feedUrl": profile["updateBaseUrl"] + "appcast.xml" if feed is not None else None,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--app", required=True)
    parser.add_argument("--repository", required=True)
    parser.add_argument("--site", required=True, type=Path)
    parser.add_argument("--dmg", required=True, type=Path)
    parser.add_argument("--receipt", required=True, type=Path)
    parser.add_argument("--feed", type=Path)
    parser.add_argument("--sums", type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    try:
        result = stage(args.app, args.repository, args.site, args.dmg, args.receipt, args.feed, args.sums)
        args.output.write_text(json.dumps(result, indent=2) + "\n")
        print(args.output)
    except (ValueError, OSError, KeyError) as error:
        print(error, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
