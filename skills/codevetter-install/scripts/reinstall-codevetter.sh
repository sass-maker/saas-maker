#!/usr/bin/env bash
set -euo pipefail

REPO="/Users/sarthak/Desktop/fleet/CodeVetter"
APP_DIR="$REPO/apps/desktop"
TARGET_APP="/Applications/CodeVetter.app"

cd "$APP_DIR"
npm run build
npm run tauri:build

BUILT_APP="$(find "$APP_DIR/src-tauri/target/release/bundle/macos" -maxdepth 1 -name '*.app' -print | sort | tail -n 1)"
if [[ -z "$BUILT_APP" || ! -d "$BUILT_APP" ]]; then
  echo "No built .app found under src-tauri/target/release/bundle/macos" >&2
  exit 1
fi

rm -rf "$TARGET_APP"
cp -R "$BUILT_APP" "$TARGET_APP"
xattr -dr com.apple.quarantine "$TARGET_APP" 2>/dev/null || true
open -a "$TARGET_APP"

echo "Installed $BUILT_APP -> $TARGET_APP"
defaults read "$TARGET_APP/Contents/Info.plist" CFBundleShortVersionString 2>/dev/null || true
