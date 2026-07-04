---
name: codevetter-install
description: Reinstall and verify the local CodeVetter desktop app from /Users/sarthak/Desktop/fleet/codevetter. Use when the user asks to install, reinstall, update, repair, or open CodeVetter, especially when normal app commands are unavailable or a fallback install workflow is needed.
---

# CodeVetter Install

Use this skill to reinstall CodeVetter from the local repo without changing secrets, commits, pushes, or releases.

## Workflow

1. Work from `/Users/sarthak/Desktop/fleet/codevetter`.
2. Read `agents.md` if present and preserve unrelated dirty work.
3. Prefer the helper script:
   - `bash /Users/sarthak/Desktop/fleet/fleet-ops/skills/codevetter-install/scripts/reinstall-codevetter.sh`
4. If the helper fails, use the manual fallback:
   - `cd /Users/sarthak/Desktop/fleet/codevetter/apps/desktop`
   - `npm run build`
   - `npm run tauri:build`
   - Find the built `.app` under `src-tauri/target/release/bundle/macos/`.
   - Copy the `.app` to `/Applications/CodeVetter.app`, replacing only that app bundle.
   - Remove quarantine if needed: `xattr -dr com.apple.quarantine /Applications/CodeVetter.app`.
   - Open with `open -a /Applications/CodeVetter.app`.
5. Verify at minimum:
   - `/Applications/CodeVetter.app` exists.
   - `mdls -name kMDItemVersion /Applications/CodeVetter.app` or `defaults read /Applications/CodeVetter.app/Contents/Info.plist CFBundleShortVersionString` returns a version.
   - The app launches with `open -a /Applications/CodeVetter.app`.

## Safety

- Do not touch `.env*`, credentials, signing secrets, or release config.
- Do not commit, push, tag, or publish releases.
- Do not delete anything except replacing `/Applications/CodeVetter.app` with the newly built app bundle.
- If Rust/Tauri build prerequisites are missing, report the exact failing command and use any existing built `.app` as fallback only if it is newer than the installed app.
