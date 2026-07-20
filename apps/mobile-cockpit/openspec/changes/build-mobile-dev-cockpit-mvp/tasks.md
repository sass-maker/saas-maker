## 1. Project foundation

- [x] 1.1 Create the pnpm workspace, Expo SDK 57 mobile app, shared protocol package, and Node bridge package
- [x] 1.2 Add fleet-standard AGENTS.md, PROJECT_STATUS.md, README, ignore rules, example configuration, and CI checks
- [x] 1.3 Add only the required Expo native modules and WebSocket bridge dependency with compatible versions

## 2. Shared protocol and secure pairing

- [x] 2.1 Define versioned request, response, event, project, process, review, and approval message types
- [x] 2.2 Implement runtime message validation and safe request dispatch without arbitrary command fields
- [x] 2.3 Implement expiring single-use pairing tokens, persistent hashed session credentials, authenticated sockets, and reconnect snapshots
- [x] 2.4 Add protocol and pairing tests for valid, invalid, expired, replayed, and unauthenticated requests
- [x] 2.5 Expire persisted session credentials and automatically reconnect the last paired bridge after cold launch
- [x] 2.6 Add a Tailscale-first secure transport choice and MagicDNS URL guidance to onboarding

## 3. Desktop bridge

- [x] 3.1 Load and validate an explicit project allowlist with canonical repository paths and argv command definitions
- [x] 3.2 Manage one owned process per project operation with streaming logs, bounded buffers, stop behavior, and status events
- [x] 3.3 Implement project listing, development server, test, configured agent instruction/stop, and state-recovery handlers
- [x] 3.4 Implement bounded Git status/diff review, per-file stage/unstage, and approval-gated tracked-file revert and staged commit
- [x] 3.5 Implement expiring one-use approvals for configured deploy and rollback commands
- [x] 3.6 Add bridge tests covering path restrictions, process lifecycle, diff bounds, approvals, and deployment rejection paths
- [x] 3.7 Add configured build execution, PTY-backed new/resume agent sessions, complete process-group termination, and private screenshot attachments
- [x] 3.8 Add tested Tailscale status detection, scoped HTTPS Serve setup/cleanup, loopback enforcement, and secure URL output

## 4. iOS cockpit

- [x] 4.1 Build connection onboarding with bridge URL validation, pairing token exchange, SecureStore persistence, transport warning, and reconnect state
- [x] 4.2 Build the project dashboard with machine status, project selection, process controls, preview/production links, and active state
- [x] 4.3 Build an isolated WebView preview with navigation, refresh, Safari, theme/orientation guidance, and screenshot sharing
- [x] 4.4 Build agent chat and terminal log views with streaming output, instruction submission, reconnect recovery, and stop controls
- [x] 4.5 Build Git review and guarded deployment screens with changed files, bounded diff, test action, approval sheet, logs, and result URLs
- [x] 4.6 Add reducer/client tests for connection state, streamed events, approvals, and project snapshots
- [x] 4.7 Add build controls, agent resume, and direct preview-screenshot delivery to the active agent
- [x] 4.8 Refresh only the successful deployment preview and offer the embedded production view from the deployment result
- [x] 4.9 Polish onboarding, machine status, and project cards using local accessible React Native primitives

## 5. Verification and handoff

- [x] 5.1 Run workspace formatting, lint, typecheck, unit tests, and Expo export checks
- [x] 5.2 Run an end-to-end bridge smoke test through pair, list, start, logs, review, approval, and stop against a fixture repository
- [x] 5.3 Verify the mobile UI in its supported local runtime and record any host-tooling limitation
- [ ] 5.4 Update PROJECT_STATUS.md with shipped evidence and archive the completed OpenSpec change only when every scenario is implemented and verified
- [x] 5.5 Verify the Tailscale CLI contract with fixtures and visually smoke-test secure and local onboarding at iPhone dimensions
- [x] 5.6 Add a clean macOS CI gate that generates the iOS project, installs CocoaPods, and compiles the complete app for iOS Simulator with the SDK 57-required Xcode toolchain
- [x] 5.7 Build a standalone Release app, install and launch it without Metro in an iPhone simulator, and visually inspect the native screenshot artifact
