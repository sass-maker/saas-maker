## Why

Developers can supervise coding agents remotely today, but they still have to stitch together terminal access, mobile browser testing, Git review, and deployment tools. Mobile Dev Cockpit turns the PRD's edit-to-deploy loop into one native iPhone workflow while keeping machine control isolated from the loaded website.

## What Changes

- Add an Expo Router iOS app for pairing a machine, choosing a repository, previewing its dev server, supervising an agent, viewing logs and diffs, running tests, and requesting guarded deployments.
- Add a local TypeScript desktop bridge that discovers configured repositories, manages child processes, streams structured events over authenticated WebSockets, and exposes narrowly scoped Git and command operations.
- Run interactive coding agents in a real pseudoterminal, support a configured resume command, and let a captured mobile preview be sent to the active agent as a controlled temporary attachment.
- Add a shared, versioned JSON protocol between the app and bridge with explicit approval requests for sensitive operations.
- Persist bridge connection tokens in iOS SecureStore and project metadata in a local bridge data file outside tracked repositories.
- Expire session credentials, remember the last paired bridge for cold-launch reconnect, and stop complete owned process groups rather than only their immediate parent.
- Add an explicit Tailscale Serve mode that keeps the bridge on loopback, configures tailnet-private HTTPS termination, prints the exact `wss://` MagicDNS URL, and provides a scoped cleanup command.
- Polish the iPhone onboarding and project dashboard into a clearer, denser operational cockpit with a Tailscale-first connection path.
- Provide local-first setup, tests, and a demo project path; hosted relay, multi-user collaboration, Android, and a full mobile editor remain out of scope.

## Capabilities

### New Capabilities

- `secure-machine-pairing`: Pair a phone to one bridge using a short-lived one-time token, persist only the resulting session credential securely, reconnect, and report machine status.
- `project-process-control`: Discover explicitly allowed projects and start, stop, and observe their development, test, agent, and deployment commands without arbitrary shell access.
- `agent-supervision`: Start or resume supported coding-agent sessions, send instructions, stream output, stop work, and route sensitive actions through approval requests.
- `mobile-preview-review`: Open the selected project's preview in an isolated WebView, refresh and navigate it, capture screenshots, and inspect current Git changes and command output.
- `guarded-deployment`: Run an explicitly configured deployment or rollback command only after mobile confirmation and surface its status, logs, and resulting URL.

### Modified Capabilities

None. This is a new product with no existing behavioral specification.

## Impact

- New local fleet project `mobile-dev-cockpit` with `apps/mobile`, `packages/bridge`, and `packages/protocol` workspaces.
- Runtime dependencies on Expo/React Native, `react-native-webview`, `expo-secure-store`, screenshot support, the `ws` WebSocket implementation for Node, and an optional user-installed Tailscale CLI for private remote connectivity.
- Local machine access is intentionally limited to configured repository roots and command templates. No production infrastructure, cloud credential, deployment, or external service is created by this change.
