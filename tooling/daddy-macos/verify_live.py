#!/usr/bin/env python3
"""Verify that a protected manual release reached its public routes byte for byte."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def remote_sha256(url: str) -> tuple[str, int]:
    digest = hashlib.sha256()
    size = 0
    request = Request(url, headers={"Cache-Control": "no-cache", "User-Agent": "DaddyReleaseVerification/1"})
    with urlopen(request, timeout=30) as response:
        if response.status != 200:
            raise ValueError(f"Unexpected HTTP {response.status} for {url}")
        for chunk in iter(lambda: response.read(1024 * 1024), b""):
            digest.update(chunk)
            size += len(chunk)
    return digest.hexdigest(), size


def verify(report: dict, dmg: Path, feed: Path | None) -> dict:
    expected = report["dmgSha256"]
    if not dmg.is_file() or hashlib.sha256(dmg.read_bytes()).hexdigest() != expected:
        raise ValueError("Local qualified DMG differs from publication report")
    urls = [report["downloadUrl"]]
    if report["updateUrl"]:
        urls.append(report["updateUrl"])
    checks = {}
    for url in urls:
        digest, size = remote_sha256(url)
        if digest != expected or size != dmg.stat().st_size:
            raise ValueError(f"Live DMG differs from qualified artifact: {url}")
        checks[url] = {"sha256": digest, "bytes": size}
    if report["feedUrl"]:
        if feed is None or not feed.is_file():
            raise ValueError("Qualified Sparkle feed is missing")
        digest, size = remote_sha256(report["feedUrl"])
        expected_feed = hashlib.sha256(feed.read_bytes()).hexdigest()
        if digest != expected_feed or size != feed.stat().st_size:
            raise ValueError("Live Sparkle feed differs from qualified feed")
        checks[report["feedUrl"]] = {"sha256": digest, "bytes": size}
    elif feed is not None:
        raise ValueError("Manual release must not claim a Sparkle feed")
    return {"state": "live-publication-verified", **report, "checks": checks}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", required=True, type=Path)
    parser.add_argument("--dmg", required=True, type=Path)
    parser.add_argument("--feed", type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    try:
        report = json.loads(args.report.read_text())
        for attempt in range(6):
            try:
                result = verify(report, args.dmg, args.feed)
                break
            except (ValueError, HTTPError, URLError, TimeoutError):
                if attempt == 5:
                    raise
                time.sleep(20)
        args.output.write_text(json.dumps(result, indent=2) + "\n")
        print(args.output)
    except (ValueError, OSError, KeyError, HTTPError, URLError, TimeoutError) as error:
        print(error, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
