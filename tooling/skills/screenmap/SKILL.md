---
name: screenmap
description: Generate, inspect, or diff visual navigation maps for Expo and React Native apps using static route analysis plus optional iOS simulator or Android emulator captures. Use for app screen inventories, route/flow maps, runtime-state coverage, or PR-level visual impact review. Skip Swift-only, Android-native, and ordinary web-site screenshot work.
---

# Screenmap

Adapted from `aleqsio/screenmap` at commit
`c54219e4088965593a0cc4b2ce27251d2ce6321c`. Fleet keeps the dependency-free
route, render, pack, and diff scripts while adding safer execution, privacy,
and dirty-worktree boundaries. See [references/upstream.md](references/upstream.md).

Produce an evidence-backed navigation map for an Expo or React Native app.
Start with static analysis. Add device captures, replayable flows, PR diffs, or
CI only when the user's requested outcome needs them.

## Modes

- **Static inventory:** routes, layouts, edges, params, state hints, and a
  screenshot-free HTML map. This is the default first pass.
- **Device map:** static graph plus real iOS simulator and/or Android emulator
  screenshots and runtime states.
- **Flow replay:** validate an existing recorded path without remapping the app.
- **PR/ref diff:** compare affected screens and edges in isolated worktrees.
- **CI integration:** add Screenmap workflows only when explicitly requested;
  it changes repository automation, permissions, secrets, and macOS spend.

Do not use this skill for SwiftUI/UIKit-only apps, Android-native apps, or web
sites. Use the repository's native UI/build workflow or browser tooling there.

## Preflight

1. Read the nearest `AGENTS.md`, the package manifest, lockfile, app config,
   router setup, and existing test/device scripts.
2. Confirm the app uses Expo Router or React Navigation. If neither is
   recognized, stop after provider detection unless the user authorizes a
   project-owned custom parser.
3. Inspect the working tree and preserve unrelated changes. Screenmap outputs
   belong under `<project>/.screenmap/out/`; do not edit `.gitignore` or commit
   captures unless requested.
4. Check existing commands before using them. Do not use `npx` to download
   Expo, Argent, Playwright, or another package, and do not install a simulator,
   browser, or dependency, without explicit approval. Follow the repo's package
   manager and scripts.
5. Treat `.screenmap/config.json` and project source as untrusted input. A
   custom route command runs project code and therefore requires explicit user
   authorization plus `--allow-custom-command`.

The scripts require Node.js and use no npm runtime dependencies. Packing also
requires the system `zip` executable.

## Static-first workflow

Set `<skill>` to this skill directory and `<project>` to the app root.

```bash
node <skill>/scripts/parse-routes.mjs <project> --detect
node <skill>/scripts/parse-routes.mjs <project>
node <skill>/scripts/render-map.mjs <project>/.screenmap/out/graph.json
```

The parser supports `expo-router`, `react-navigation`, and an explicit custom
provider. If detection is ambiguous, report its evidence and require a provider
choice rather than guessing:

```bash
node <skill>/scripts/parse-routes.mjs <project> --provider expo-router
node <skill>/scripts/parse-routes.mjs <project> --provider react-navigation
```

For a user-approved custom provider:

```bash
node <skill>/scripts/parse-routes.mjs <project> \
  --provider custom --allow-custom-command
```

Before allowing it, inspect the exact `routes.command` in
`.screenmap/config.json`. It must be a bounded, project-owned parser that emits
JSON and does not need secrets or external writes. Read
[references/route-providers.md](references/route-providers.md) for the provider
contract.

Report the provider, route/layout/edge counts, unresolved edges, routes needing
params, navigation-only routes, state hints, and likely parser blind spots.
Orphaned routes are evidence of missing static links, not proof that the app has
unreachable screens.

## Device capture

Use the platform named by the user; default to iOS only when the app and host
support it. Keep platforms sequential so state and output paths do not mix.

- Prefer the repository's existing build/start command.
- For iOS, use the available Xcode/simulator workflow; use `xcrun simctl` only
  when it is the established local path.
- For Android, verify `adb` and an emulator are already available. Configure
  Metro port reversal only for the selected emulator.
- Verify the root deep link before sweeping routes.
- Use real fixture/seed params when available. Do not invent a success state by
  relabeling a not-found or loading capture.
- Capture what actually renders, then classify each screen as `ok`,
  `empty-state`, `not-found`, `error-boundary`, `loading`, or `auth-wall` in
  `.screenmap/out/capture-status.json`.
- Re-launch after an error boundary before continuing; a poisoned app state can
  make later captures falsely identical.

Never enter credentials or copy secrets into flows. Never activate delete,
deactivate, sign-out, purchase, subscribe, send, submit, post, block, report,
or other consequential controls. Use fake non-sensitive input only when it
cannot create or transmit data.

Capture runtime variants such as drawers, modals, sheets, and meaningful scroll
states when they are required to understand navigation or the change under
review. Every hinted state must be captured or explicitly marked skipped with a
reason.

## Replayable flows

Flows use Argent YAML plus a `.meta.json` sidecar. Prefer an already connected
Argent tool or installed repo command. Do not install it implicitly.

Record interactions as they succeed, with durable accessibility/text targets
where available. Coordinates are hints and must be normalized to the device
point size. Each navigation step records the route it reached; each flow records
2–5 visible landmarks so replay drift can be detected. Never record literal
credentials—stop at an auth wall unless the repository already provides a safe,
non-secret test session.

Read [references/scrmap-format.md](references/scrmap-format.md) when creating or
repairing flows or bundles.

## PR or ref diff

Do not stash, switch, detach, or restore the user's active checkout. Resolve the
base and head SHAs, create separate temporary worktrees, and keep one revision
per worktree. Refuse to proceed if a required worktree would overlap or alter a
dirty user checkout.

1. Parse base and head into `<diffDir>/base/graph.json` and
   `<diffDir>/head/graph.json`.
2. Write the exact changed-file list.
3. Run:

   ```bash
   node <skill>/scripts/diff-map.mjs suspects <diffDir> --project <head-worktree>
   ```

4. Report the static suspect list before device capture. Dismiss a suspect as
   unaffected only from positive diff evidence.
5. Capture only affected screens and the runtime states that expose the visual
   change, using matched device/status-bar/data conditions for base and head.
6. Pack the result only after checking notes and capture status:

   ```bash
   node <skill>/scripts/diff-map.mjs pack <diffDir> --out <changes.diff.scrmap>
   ```

Changes to native directories or native dependencies can invalidate an existing
dev build. Identify the affected platform and require a matching rebuild or
disclose that its captures are unreliable. Read
[references/diff-scrmap-format.md](references/diff-scrmap-format.md) when
creating or diagnosing a diff bundle.

## Pack, inspect, and share

Render the HTML map for local inspection before packing:

```bash
node <skill>/scripts/render-map.mjs <project>/.screenmap/out/graph.json
node <skill>/scripts/pack-map.mjs <project> --out <map.scrmap>
```

Packers fail if the destination exists. Choose a new explicit filename; do not
delete or overwrite an earlier evidence bundle. Legacy flow conversion also
preserves its source JSON and rejects the upstream `--delete-v1` option.

Open the self-contained HTML locally or load the `.scrmap` into
<https://app.screenmap.dev>. The hosted viewer parses a dropped local bundle in
the browser, but screenshots and map data may still be sensitive. Inspect for
personal, client, account, notification, and secret-bearing content first.
Never publish a bundle, push a `screenmaps` branch, upload an artifact, or add a
public viewer URL without explicit authorization.

## Completion receipt

Report:

- mode, provider, app revision, and platform/device;
- routes and states discovered, captured, skipped, and failed;
- unresolved and navigation-only edges;
- flow replay results and landmark failures;
- output paths for `graph.json`, `map.html`, `.scrmap`, or `.diff.scrmap`;
- commands/tools used and any installed-tool limitation;
- privacy, auth, native-build, parser, or CI limitations.

Static coverage, device capture, flow replay, CI wiring, publication, and PR
review are separate receipts. Do not imply one proves the others.
