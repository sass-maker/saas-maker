# Mobile Dev Cockpit — PROJECT STATUS

Last updated: 2026-07-13

## Why / What

Mobile Dev Cockpit is a native iPhone interface for supervising development on a laptop or remote machine: select an allowlisted repository, start its dev server, preview the website, instruct a coding agent, review Git changes, run tests, and approve deployment.

**Users:** Developers using Codex, Claude Code, or another configured CLI agent who want to supervise an edit-to-deploy loop from an iPhone.

**IN scope:** Single-user machine pairing, configured repositories and commands, streamed logs, agent supervision, isolated WebView preview, Git review, tests, and guarded deploy/rollback.

**OUT of scope:** General SSH, arbitrary remote shell, full code editing, hosted relay/accounts, collaboration, Android, plugin marketplace, hosting, and device-farm testing.

## Dependencies

### External

- Expo SDK 57, React Native, Expo Router, SecureStore, WebView, view capture, and system sharing.
- Node.js 22+, the `ws` WebSocket server package, and `node-pty` for owned interactive agent sessions.
- Git and whichever dev, test, agent, and deploy CLIs a user explicitly configures.
- Optional Tailscale CLI and a signed-in tailnet for the recommended private HTTPS remote transport; LAN or another TLS reverse proxy remains supported.

### Internal

- No runtime dependency on another fleet repository.

## Timeline

- 2026-07-12 — Product PRD accepted; OpenSpec MVP proposal, design, capability specs, and implementation tasks validated.
- 2026-07-12 — Local monorepo scaffold started for the iOS app, desktop bridge, and shared protocol.
- 2026-07-12 — Working MVP implemented and browser-smoke-tested through pairing, reconnect, project control, live logs, agent instruction, Git review, and deployment cancellation; 20/20 Expo Doctor checks and native iOS bundle export pass.
- 2026-07-13 — Closed the remaining host-independent PRD gaps: expiring sessions and cold-launch reconnect, build/tunnel controls, PTY-backed new/resume agent sessions, complete process-group shutdown, stale Git approval rejection, private screenshot-to-agent delivery, compiled bridge CLI, and CLI packaging verification.
- 2026-07-13 — Re-ran 390x844 end-to-end smoke tests through pairing, dev process lifecycle, PTY resume/instruction/stop, guarded deployment, refreshed embedded production preview, and credential cleanup with no browser errors. Workspace checks pass; web and iOS exports pass; native prebuild succeeds. Expo Doctor is 19/20 because CocoaPods is absent.
- 2026-07-13 — Added Tailscale-first onboarding and a loopback-only Tailscale Serve CLI mode with scoped setup/cleanup, MagicDNS WSS output, unsafe-binding rejection, and tests. Polished the iPhone onboarding and dashboard using local React Native primitives and visually verified both secure and local modes at 390x844.

## Products

- `apps/mobile` — Expo Router iOS app with a web development fallback.
- `packages/bridge` — local Node.js machine bridge.
- `packages/protocol` — shared versioned JSON message contract.

## Features (shipped)

- Versioned shared protocol with strict runtime message validation and no arbitrary mobile command channel.
- Five-minute one-use pairing token, bounded expiring hashed session credentials, iOS SecureStore client storage, cold-launch reconnect, reconnect backoff, and full state/log recovery.
- Tailscale Serve integration that retains loopback binding, checks connected/MagicDNS state, configures only `/mobile-dev-cockpit`, prints the secure WSS URL, and removes that mapping without touching unrelated services.
- Read-only bounded repository discovery plus explicit allowlisted project configuration.
- Configured dev/tunnel/build/test/agent/deploy/rollback processes with streamed logs, complete process-group stop controls, detected preview URLs, and advertised-host rewriting.
- Native isolated WebView preview with back, refresh, Safari, screenshot sharing, orientation control, theme hint cycling, and dev/production targets.
- PTY-backed agent supervision with new/resume controls, instruction and prompt-decision streaming, active-session survival across network reconnects, and validated private screenshot attachments.
- Bounded Git review with per-file stage/unstage, protected tracked-file revert, staged-only commit, untracked-file deletion prevention, and exact-state fingerprints that invalidate stale approvals.
- One-use expiring approval gates for deploy, rollback, revert, and commit.
- Successful deployments invalidate the embedded production preview and expose a direct in-app refresh action; failed and stopped deployments preserve the current preview.
- Compiled bridge CLI with an executable package entrypoint and reproducible native PTY helper preparation.
- Polished Tailscale-first onboarding, encrypted/development transport states, three-step setup rail, trusted-machine status, and dense project cards built without another UI dependency.
- Expo web fallback used for 390x844 visual verification and local end-to-end smoke testing; generated iOS native project and both platform bundles verified locally.

## Todo / Planned / Deferred / Blocked

1. Blocked: compile/install and validate WKWebView, Keychain persistence, screenshot sharing, orientation, and reconnect on a physical iPhone; this Mac has Command Line Tools only, no full Xcode installation, and no CocoaPods.
2. Deferred: hosted relay and account system, pending evidence that private Tailscale connectivity is insufficient.
3. Deferred: App Store/TestFlight distribution decision, pending physical-device validation and policy review.
