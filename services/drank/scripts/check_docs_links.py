#!/usr/bin/env python3
"""Check internal Markdown links resolve to a real file in the repo.

Blume's `validate` is the presentation-layer check (it only knows about the
`docs/` route space, so it flags valid `../../AGENTS.md`-style links as broken).
This script is the *source-of-truth* check: it walks the actual filesystem and
fails when a Markdown link points at a path that does not exist.

Scope:
  - All `*.md` under `docs/`.
  - Root-level `*.md` files (AGENTS.md, README.md, PROJECT_STATUS.md,
    STATUS.md, CLAUDE.md).

Link forms handled:
  - Inline:        [text](target)
  - Reference:     [text][ref] ... [ref]: target
  - Auto-link:     <target>  (only file:// or relative paths; http(s) skipped)

Skipped (not filesystem concerns):
  - External:      http://, https://, mailto:, ftp:, data:, tel:
  - Anchor-only:   #section
  - Absolute site: /route          (Blume route space; checked by `blume validate`)

For each kept link, the anchor (`#...`) and query (`?...`) are stripped, the
target is resolved relative to the source file's directory, and the target must
exist as a file or directory. A target with no extension that matches a real
`.md` file is accepted (so `docs/factory` resolves to `docs/factory.md`-style
pages and directory links work).

Allowlist: `scripts/docs-link-allowlist.txt` (one entry per line, format
`<source-relative-path>::<target-as-written`). Blank lines and `#` comments
ignored. Use the allowlist only for genuinely-missing historical targets that
are intentionally not recreated; never use it to silence new breakage.

Exit code: 0 if all non-allowlisted links resolve, 1 otherwise.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parents[1]
ALLOWLIST = ROOT / "scripts" / "docs-link-allowlist.txt"

# Directories whose Markdown we scan.
SCAN_DIRS = [ROOT / "docs"]
# Root-level Markdown files to also scan.
ROOT_FILES = sorted(p for p in ROOT.glob("*.md") if p.is_file())

# Link syntaxes.
INLINE_RE = re.compile(r"(?<!\\)\[(?P<text>[^\]]*)\]\((?P<url>[^)\s]+)(?:\s+\"[^\"]*\")?\)")
REF_DEF_RE = re.compile(r"^\s*(?P<label>\[[^\]]+\]):\s*(?P<url>\S+)(?:\s+\"[^\"]*\")?\s*$", re.MULTILINE)
REF_USE_RE = re.compile(r"(?<!\\)\[(?P<text>[^\]]*)\]\[(?P<ref>[^\]]+)\]")
AUTO_RE = re.compile(r"<(?P<url>(?:file:|/|\.\.?/)[^>]+)>")

EXTERNAL_SCHEMES = {"http", "https", "mailto", "ftp", "ftps", "tel", "data", "sms"}


def is_external(url: str) -> bool:
    if url.startswith("#"):
        return True
    scheme = urlparse(url).scheme.lower()
    if scheme in EXTERNAL_SCHEMES:
        return True
    # `//host/...` protocol-relative.
    if url.startswith("//"):
        return True
    return False


def strip_anchor_query(url: str) -> str:
    # Keep the path part only; drop `#anchor` and `?query`.
    parsed = urlparse(url)
    return unquote(parsed.path)


def resolve_target(source: Path, raw: str) -> Path:
    target = strip_anchor_query(raw)
    base = source.parent
    if not target:
        return base
    if target.startswith("/"):
        # Repo-root-relative absolute path (e.g. /AGENTS.md). Treat as repo root.
        return ROOT / target.lstrip("/")
    return (base / target).resolve()


def target_exists(path: Path) -> bool:
    if path.exists():
        return True
    # Allow extensionless links to resolve to a `.md` file (Blume route style
    # used inside docs/, e.g. `[factory](/factory)` or `[x](factory)`).
    if path.is_dir() or (path.with_suffix(".md")).exists():
        return True
    # Allow linking to a directory's README when the bare dir is referenced.
    if (path / "README.md").exists():
        return True
    return False


def collect_links(source: Path) -> list[tuple[str, str]]:
    """Return list of (raw_target, source-relative-path) for one file."""
    text = source.read_text(encoding="utf-8", errors="replace")
    out: list[tuple[str, str]] = []
    # Inline links.
    for m in INLINE_RE.finditer(text):
        out.append((m.group("url"), source.relative_to(ROOT).as_posix()))
    # Auto-links to relative/absolute paths.
    for m in AUTO_RE.finditer(text):
        out.append((m.group("url"), source.relative_to(ROOT).as_posix()))
    # Reference-style: build ref->url map, then resolve uses.
    ref_map: dict[str, str] = {}
    for m in REF_DEF_RE.finditer(text):
        ref_map[m.group("label").strip().lower()] = m.group("url")
    for m in REF_USE_RE.finditer(text):
        ref = m.group("ref").strip().lower()
        if ref in ref_map:
            out.append((ref_map[ref], source.relative_to(ROOT).as_posix()))
        elif m.group("text").strip().lower() in ref_map:
            # `[ref][]` shorthand.
            out.append((ref_map[m.group("text").strip().lower()], source.relative_to(ROOT).as_posix()))
    return out


def load_allowlist() -> set[str]:
    allowed: set[str] = set()
    if not ALLOWLIST.is_file():
        return allowed
    for line in ALLOWLIST.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        allowed.add(line)
    return allowed


def main() -> int:
    sources: list[Path] = []
    for d in SCAN_DIRS:
        sources.extend(sorted(d.rglob("*.md")))
    sources.extend(ROOT_FILES)
    sources = sorted(set(sources))

    allowed = load_allowlist()
    broken: list[str] = []
    seen: set[tuple[str, str]] = set()

    for source in sources:
        for raw, rel in collect_links(source):
            if is_external(raw):
                continue
            target = strip_anchor_query(raw)
            if not target:
                continue
            key = (rel, raw)
            if key in seen:
                continue
            seen.add(key)
            resolved = resolve_target(source, raw)
            if target_exists(resolved):
                continue
            if f"{rel}::{raw}" in allowed:
                continue
            broken.append(f"{rel}: {raw}")

    if broken:
        print(f"FAIL: {len(broken)} broken internal link(s):", file=sys.stderr)
        for b in sorted(broken):
            print(f"  {b}", file=sys.stderr)
        print(
            "\nIf a broken link points to a deliberately-missing historical "
            "target, add it to scripts/docs-link-allowlist.txt as "
            "`<source>::<target>`. Otherwise fix the link or create the target.",
            file=sys.stderr,
        )
        return 1
    print(f"docs link check ok ({len(seen)} internal links across {len(sources)} files)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
