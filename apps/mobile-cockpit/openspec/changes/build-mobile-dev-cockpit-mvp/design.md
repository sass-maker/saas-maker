## Context

The product has two trust domains: an iPhone UI and a developer-controlled machine with repository, Git, process, and deployment access. A website rendered inside the preview is untrusted and must never inherit bridge authority. The first release must prove the complete local edit-to-deploy loop without requiring a hosted service.

## Goals / Non-Goals

**Goals:**

- Provide one typed protocol for discovery, process state, logs, diffs, approvals, and preview URLs.
- Make the happy path work over a developer-supplied reachable bridge URL, including LAN, Tailscale, or a TLS reverse proxy.
- Restrict execution to commands and repository roots declared in bridge configuration.
- Keep the mobile UI useful during reconnects and make every long-running operation stoppable.
- Keep WebView content isolated from control APIs and native bridge messages.

**Non-Goals:**

- Hosted relay infrastructure, account systems, collaboration, Android, arbitrary SSH, a full code editor, or provider-specific deployment APIs.
- Silently running migrations, force pushes, destructive Git operations, or secret-reading commands.
- Guaranteeing identical behavior between `WKWebView` and Mobile Safari.

## Decisions

### Use a pnpm TypeScript workspace

The Expo app, Node bridge, and protocol package share message types and can be checked together. A single workspace is simpler than publishing protocol packages. Go and Rust were considered for the bridge, but TypeScript minimizes duplicated schemas and gets the MVP to a verifiable loop faster.

### Use Expo Router with a development-build-compatible dependency set

Expo Router provides native navigation and a web fallback for fast UI verification. `react-native-webview`, SecureStore, and screenshot capture are supported Expo modules. Native SSH is excluded; the app talks only to the bridge.

### Use request/response commands plus server-pushed WebSocket events

One authenticated WebSocket carries versioned JSON envelopes. Requests have IDs and receive success/error responses; logs and status changes are events. This avoids maintaining separate REST and socket authorization models and makes reconnect recovery deterministic through a fresh snapshot request.

### Exchange a one-time pairing token for a session credential

The bridge prints a short-lived pairing token. The app sends it once and stores the returned high-entropy session token in SecureStore. Session tokens are held in a local bridge state file with owner-only permissions. TLS termination is supplied by Tailscale or a user-configured HTTPS endpoint in production; plain `ws://` is allowed only for local development and is visibly labeled insecure.

### Make Tailscale Serve the recommended remote transport

An explicit `--tailscale` bridge flag checks that Tailscale is running, reads the machine's MagicDNS name, and configures `tailscale serve --bg --yes --https=443 --set-path=/mobile-dev-cockpit http://127.0.0.1:<bridge-port>`. The bridge remains loopback-only; Tailscale owns TLS termination and tailnet access control. The CLI prints the resulting `wss://<dns-name>/mobile-dev-cockpit` URL and a scoped `tailscale-off` command. Funnel is deliberately unsupported because the bridge must never become public internet infrastructure.

### Keep the mobile cockpit visually operational

The first-run screen leads with the trusted transport choice, a short three-step pairing rail, stronger status hierarchy, and clearer secure/insecure states. The dashboard prioritizes machine state, active work, and available capabilities while retaining accessible text labels and existing native controls. This polish uses local React Native primitives and tokens rather than adding a UI dependency.

### Configure commands instead of accepting shell strings from the phone

Each project declares argv-based `dev`, `test`, `deploy`, `rollback`, and optional agent commands. The mobile protocol references an operation name and sends instruction text only to an agent process stdin. This prevents the phone UI from becoming an arbitrary remote shell.

### Isolate preview content

The WebView receives only a URL. It has no injected JavaScript bridge, no session credential, no control endpoint, and no shared message handler. Preview navigation is limited to HTTP(S); external schemes are rejected or opened through the OS.

### Make approvals bridge-enforced

Deploy and rollback always create an approval request before a process starts. The bridge owns pending approval state and rejects stale, mismatched, or replayed decisions. The UI cannot bypass the gate by issuing a lower-level command.

## Risks / Trade-offs

- [A reachable machine bridge is a high-value target] → Bind to loopback by default, require an explicit host override, authenticate every post-pairing message, use short token lifetimes, and document TLS/Tailscale as the remote path.
- [Interactive agent CLIs can leak child processes or lose terminal semantics] → Run them in an owned pseudoterminal, terminate the complete owned process group, and retain bounded structured logs.
- [A persistent Tailscale Serve mapping can outlive the bridge] → Require an explicit `--tailscale` flag, print the exact scoped cleanup command, provide `tailscale-off`, and never invoke Funnel.
- [iOS background suspension interrupts streaming] → Persist connection details, reconnect with exponential backoff, and request a complete state snapshot after reconnect.
- [Agent CLIs differ] → Model agents as configured argv commands with a minimal stdin/stdout contract rather than hard-coding one vendor.
- [Hot reload URLs may not be reachable from the phone] → Allow an explicit preview URL and derive a LAN address only when the dev server reports a port.
- [A generic deploy command can still be dangerous] → Require explicit project configuration and a fresh mobile approval, stream the exact command label, and never run it automatically.

## Migration Plan

This is a new local product. Install workspace dependencies, copy the example bridge configuration to a user-owned untracked location, start the bridge, pair the iOS development build, and add projects incrementally. Rollback is removing the local app and bridge state; no production data migration exists.

## Open Questions

- Whether a hosted relay is valuable enough after local/Tailscale validation to justify an account and infrastructure surface.
- Which agent CLIs need a PTY rather than stdin/stdout process control.
- Whether App Store distribution constraints permit the intended remote development workflow or TestFlight/private distribution is the better first channel.
