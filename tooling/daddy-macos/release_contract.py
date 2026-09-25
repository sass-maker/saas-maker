#!/usr/bin/env python3
"""Credential-free validation of Daddy macOS release metadata and update feeds."""

from __future__ import annotations

import argparse
import base64
import binascii
import hashlib
import json
from pathlib import Path
import plistlib
import re
import sys
from urllib.parse import urlparse
import xml.etree.ElementTree as ET

from candidate import profile_for


SPARKLE = "{http://www.andymatuschak.org/xml-namespaces/sparkle}"
TAG = re.compile(r"v((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))-(\d+)")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def validate_version(tag: str, info: dict, profile: dict, previous_build: int | None = None) -> tuple[str, int]:
    match = TAG.fullmatch(tag)
    if not match:
        raise ValueError("Release tag must be v<major>.<minor>.<patch>-<build>")
    version, build_string = match.groups()
    build = int(build_string)
    if build < 1 or str(build) != build_string or (previous_build is not None and build <= previous_build):
        raise ValueError("Release build must be positive and exceed the previous published build")
    if info.get("CFBundleIdentifier") != profile["bundleId"] or info.get("CFBundleExecutable") != profile["executable"]:
        raise ValueError("Bundle identifier or executable does not match the app profile")
    if info.get("CFBundleShortVersionString") != version or info.get("CFBundleVersion") != build_string:
        raise ValueError("Tag version/build does not match Info.plist")
    return version, build


def validate_notarization(notary: dict) -> str:
    submission_id = notary.get("id")
    if notary.get("status") != "Accepted" or not isinstance(submission_id, str) or not submission_id:
        raise ValueError("Notarization must be accepted and have a submission ID")
    return submission_id


def validate_checksum(dmg: Path, sums: Path) -> str:
    if not dmg.is_file() or not sums.is_file():
        raise ValueError("DMG and post-staple SHA256SUMS are required")
    entries = {}
    for line in sums.read_text().splitlines():
        fields = line.split()
        if len(fields) != 2 or not re.fullmatch(r"[0-9a-f]{64}", fields[0]) or Path(fields[1]).name != fields[1]:
            raise ValueError("Malformed SHA256SUMS record")
        if fields[1] in entries:
            raise ValueError("Duplicate SHA256SUMS filename")
        entries[fields[1]] = fields[0]
    digest = sha256_file(dmg)
    if entries != {dmg.name: digest}:
        raise ValueError("Post-staple DMG checksum mismatch")
    return digest


def validate_appcast(feed: Path, dmg: Path, version: str, build: int, base_url: str) -> None:
    if not feed.is_file():
        raise ValueError("Missing Sparkle appcast")
    document = ET.parse(feed).getroot()
    items = document.findall("./channel/item")
    if len(items) != 1:
        raise ValueError("Expected one appcast item for the qualified artifact")
    item = items[0]
    if item.findtext(f"{SPARKLE}version") != str(build) or item.findtext(f"{SPARKLE}shortVersionString") != version:
        raise ValueError("Appcast version/build does not match qualified artifact")
    enclosures = item.findall("enclosure")
    if len(enclosures) != 1:
        raise ValueError("Expected one Sparkle enclosure")
    enclosure = enclosures[0]
    expected_url = base_url + dmg.name
    if enclosure.get("url") != expected_url or urlparse(expected_url).scheme != "https":
        raise ValueError("Appcast URL does not match the app profile and DMG")
    if enclosure.get("length") != str(dmg.stat().st_size):
        raise ValueError("Appcast enclosure length does not match DMG")
    signature = enclosure.get(f"{SPARKLE}edSignature", "")
    try:
        if len(base64.b64decode(signature, validate=True)) != 64:
            raise ValueError("Sparkle EdDSA signature must decode to 64 bytes")
    except (ValueError, binascii.Error) as error:
        raise ValueError("Missing or malformed Sparkle EdDSA signature") from error


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--app", required=True)
    parser.add_argument("--repository", required=True)
    parser.add_argument("--tag", required=True)
    parser.add_argument("--plist", required=True, type=Path)
    parser.add_argument("--dmg", required=True, type=Path)
    parser.add_argument("--sums", required=True, type=Path)
    parser.add_argument("--notary-json", required=True, type=Path)
    parser.add_argument("--feed", type=Path)
    parser.add_argument("--previous-build", type=int)
    parser.add_argument("--source-sha", required=True)
    parser.add_argument("--receipt", required=True, type=Path)
    args = parser.parse_args()
    try:
        if not re.fullmatch(r"[0-9a-f]{40}", args.source_sha):
            raise ValueError("Source SHA must be a full commit hash")
        profile = profile_for(args.app, args.repository)
        info = plistlib.loads(args.plist.read_bytes())
        version, build = validate_version(args.tag, info, profile, args.previous_build)
        digest = validate_checksum(args.dmg, args.sums)
        submission_id = validate_notarization(json.loads(args.notary_json.read_text()))
        if profile["updateMode"] == "sparkle":
            if args.feed is None:
                raise ValueError("Sparkle app requires a signed appcast")
            validate_appcast(args.feed, args.dmg, version, build, profile["updateBaseUrl"])
        elif args.feed is not None:
            raise ValueError("Manual-update app must not claim a Sparkle feed")
        receipt = {
            "schemaVersion": 1,
            "state": "release-metadata-validated",
            "app": args.app,
            "repository": args.repository,
            "sourceSha": args.source_sha,
            "version": version,
            "build": build,
            "bundleId": profile["bundleId"],
            "dmgSha256": digest,
            "notarySubmissionId": submission_id,
            "notaryStatus": "Accepted",
            "updateMode": profile["updateMode"],
        }
        args.receipt.parent.mkdir(parents=True, exist_ok=True)
        args.receipt.write_text(json.dumps(receipt, indent=2) + "\n")
        print(args.receipt)
    except (ValueError, OSError, ET.ParseError) as error:
        print(error, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
