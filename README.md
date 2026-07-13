# Mobile Dev Cockpit

An iPhone cockpit for a developer-controlled machine: pair once, choose an allowlisted repository, run its dev server and agent, preview the site, review changes, run tests, and explicitly approve deployment.

## Trust model

- The bridge binds to `127.0.0.1` unless configuration explicitly opts into another host.
- The phone can invoke only named operations whose argv is declared in local configuration.
- Pairing tokens expire after five minutes and can be used once. Session credentials are stored hashed by the bridge and in iOS SecureStore by the app.
- Session credentials expire after the configured bounded lifetime (24 hours by default); expired credentials must pair again.
- Preview WebViews receive only HTTP(S) URLs—never bridge credentials or a native control channel.
- Deploy, rollback, tracked-file revert, and staged commit require a fresh approval generated and consumed by the bridge.
- Coding agents run in an owned PTY. Prompt approvals are sent only to that visible session, and stopping an operation terminates the complete owned process group.
- For remote use, expose the loopback bridge through tailnet-private Tailscale Serve or another TLS reverse proxy and connect with `wss://`. The product never enables public Tailscale Funnel. Plain `ws://` is development-only.

## Setup

Requirements: Node.js 22+, pnpm 10, Git, and an Expo-compatible iOS development environment.

```bash
pnpm install
pnpm build:bridge
cp config.example.json config.local.json
pnpm bridge -- --config ./config.local.json
pnpm mobile
```

Edit `config.local.json` with absolute repository paths and argv arrays. The bridge prints a one-time pairing token. Enter the reachable bridge URL and token in the app.

### Tailscale (recommended)

Install and sign in to Tailscale on the Mac and iPhone, keep the bridge host set to `127.0.0.1`, then run:

```bash
pnpm bridge -- --config ./config.local.json --tailscale
```

The bridge checks the local Tailscale state, configures private HTTPS Serve at `/mobile-dev-cockpit`, and prints a URL like:

```text
wss://your-mac.your-tailnet.ts.net/mobile-dev-cockpit
```

Paste that URL into the app's Tailscale connection mode. Tailscale terminates TLS and applies the tailnet's access-control policy; the underlying bridge remains reachable only on loopback. The Serve mapping runs in the background until explicitly disabled:

```bash
pnpm bridge -- tailscale-off
# or, for the built binary:
mobile-dev-cockpit-bridge tailscale-off
```

This integration uses Tailscale Serve, never Funnel. If tailnet HTTPS is not enabled yet, follow the one-time consent flow described in the [Tailscale Serve documentation](https://tailscale.com/docs/features/tailscale-serve).

For a built bridge instead of the TypeScript development entrypoint:

```bash
pnpm --filter @mobile-dev-cockpit/bridge start -- --config ./config.local.json
```

To find Git repositories before configuring them:

```bash
pnpm discover -- --root ~/Desktop
```

Discovery is read-only and bounded to three directory levels. A discovered repository is not controllable until it is explicitly added to the bridge configuration.

## Configuration

Commands are argv arrays, never shell strings. Environment variables can be declared per project, but local configs are ignored and must not contain secrets unless the configured command itself requires them.

```json
{
  "machineName": "My Mac",
  "host": "127.0.0.1",
  "advertisedHost": "your-machine.tailnet.ts.net",
  "port": 4782,
  "projects": [
    {
      "id": "example",
      "name": "Example site",
      "repositoryPath": "/absolute/path/to/example",
      "previewUrl": "http://127.0.0.1:5173",
      "productionUrl": "https://example.com",
      "commands": {
        "dev": ["pnpm", "dev", "--host", "0.0.0.0"],
        "tunnel": ["cloudflared", "tunnel", "--url", "http://127.0.0.1:5173"],
        "build": ["pnpm", "build"],
        "test": ["pnpm", "test"],
        "agent": ["codex", "--no-alt-screen", "-a", "on-request"],
        "agentResume": [
          "codex",
          "--no-alt-screen",
          "-a",
          "on-request",
          "resume",
          "--last"
        ],
        "deploy": ["pnpm", "deploy"]
      }
    }
  ]
}
```

`127.0.0.1` in a preview URL refers to the phone when loaded there. For a physical device, set `advertisedHost` to the Mac's MagicDNS name or configure another HTTPS preview URL reachable from the phone.
When a development process prints an HTTP(S) URL, the bridge detects it and publishes it to the app. `advertisedHost` rewrites loopback hostnames in detected URLs to a phone-reachable LAN or Tailscale host.
An optional configured `tunnel` argv can run a user-installed tool such as `cloudflared`; the first HTTP(S) URL it prints becomes the project preview URL. Mobile Dev Cockpit does not install, authenticate, or manage that external tunnel provider.
The example Codex commands use the installed CLI's interactive approval mode and resume its latest local session. Replace them with another allowlisted agent argv when needed.

Native screenshot delivery writes a validated JPEG or PNG to the bridge's private state directory and sends only that local path plus the optional note to the active agent PTY. Attachments are never executed.

After a successful deployment, the deploy screen offers the refreshed production URL inside the embedded preview as well as Safari. Failed or stopped deployments retain their logs without invalidating the current WebView.

## Checks

```bash
pnpm check
pnpm build:bridge
pnpm mobile:export
pnpm mobile:export:ios
```

`expo prebuild --platform ios --no-install` can generate the native project. A physical-device build still requires full Xcode and CocoaPods on the Mac.

The feature contract and progress live in `openspec/changes/build-mobile-dev-cockpit-mvp/` until the MVP is fully verified and archived.
