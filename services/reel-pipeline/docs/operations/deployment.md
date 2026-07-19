# Deployment

Where the pipeline daemons run and how to migrate between hosts. The code itself is OS-agnostic; this doc covers the boring per-host setup.

## Hosts the pipeline can live on

| Host | Cost/mo | Speed (vs M5 baseline) | Daemon supervisor | Status |
|---|---|---|---|---|
| **M5 Mac Pro 48GB** | $0 | 1.0x | launchd | Temporary validation only — not a permanent home (user's active workstation) |
| **M1 Pro 16GB** | $0 | ~0.5x | launchd | Viable zero-cost fallback, capped at 1 concurrent render |
| **Hetzner CCX23** (4 vCPU AMD, 16GB) | ~$32 | ~1.2x | systemd | **Recommended primary** |
| **Hetzner CCX33** (8 vCPU AMD, 32GB) | ~$60 | ~2x | systemd | Upgrade path once batches outgrow CCX23 |
| Fly.io / Railway (dedicated CPU) | $50–$100 | ~1x | platform-native | Easier deploy, worse $/perf |

Pick one. Don't run the autopilot on two hosts simultaneously — both would race for the same SaaS Maker rows.

## What every host needs

Independent of OS:

- **Node ≥ 20** (`engines.node` in `package.json`) — runs `render-pro.js`, the
  media adapters, and the local dev server
- **Rust stable** (`cargo`) — the autopilot / watch / post / metrics daemons are
  the `reel` CLI (`reel/Cargo.toml`)
- **ffmpeg + ffprobe** on PATH (or set `FFMPEG_PATH`/`FFPROBE_PATH` in `.env`)
- **Disk**: 20GB free for `artifacts/` and `tmp/`. Renders are bursty but get cleaned by the artifact publisher.
- **Outbound network**: api.openai-compatible.com (DeepSeek), api.elevenlabs.io, api.pexels.com, oauth2.googleapis.com, graph.instagram.com, api.sassmaker.com, R2 endpoint.
- **No inbound ports required.** Everything is outbound except the one-shot OAuth bootstrap scripts (which need `http://127.0.0.1:8765–8766` reachable from the local browser).

Secrets:
- `.env` (gitignored)
- `config/social-accounts.json` (gitignored — references env vars by name)
- `REEL_INTERNAL_TOKEN` in the host `.env` and as a required encrypted secret
  on the Artifact Worker. The values must match; never put the value in tracked
  config. Internal Worker clients fail closed when it is absent.

## Hetzner CCX23 setup (recommended)

Ubuntu 24.04 image. ~30 minutes from `apt update` to first autopilot tick.

```bash
# 1. System deps
sudo apt update && sudo apt install -y ffmpeg git curl build-essential
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y   # cargo for the reel CLI

# 2. App user (don't run as root)
sudo useradd -m -s /bin/bash reel
sudo -u reel -i

# 3. Clone + install
git clone https://github.com/<you>/reel-pipeline.git
cd reel-pipeline
npm ci

# 4. Drop in .env + config/social-accounts.json (see "Secret sync" below)

# 5. Run one tick to verify
cargo run --quiet --manifest-path reel/Cargo.toml -- autopilot --once --execute --repo-root .

# 6. Install systemd units (see next section)
```

If you ever wire the Remotion renderer (`REEL_RENDER_MODE=reel-maker`), add:
```bash
sudo apt install -y xvfb chromium-browser libnss3 libatk1.0-0 libgbm1
```
…and prefix the render command with `xvfb-run -a`. Not needed for the current `mock`/`moneyprinterturbo` path.

### systemd units

Put these in `/etc/systemd/system/`. Replace `/home/reel/reel-pipeline` if you cloned elsewhere.

`reel-autopilot.service`:
```ini
[Unit]
Description=Reel marketing autopilot (SaaS Maker → render → post)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=reel
WorkingDirectory=/home/reel/reel-pipeline
EnvironmentFile=/home/reel/reel-pipeline/.env
ExecStart=/usr/bin/cargo run --quiet --manifest-path reel/Cargo.toml -- autopilot --execute --repo-root .
Restart=always
RestartSec=10
StandardOutput=append:/var/log/reel-autopilot.log
StandardError=append:/var/log/reel-autopilot.err

[Install]
WantedBy=multi-user.target
```

`reel-ig-refresh.service`:
```ini
[Unit]
Description=Refresh Instagram long-lived tokens
[Service]
Type=oneshot
User=reel
WorkingDirectory=/home/reel/reel-pipeline
EnvironmentFile=/home/reel/reel-pipeline/.env
ExecStart=/usr/bin/node scripts/refresh-instagram-tokens.js
```

`reel-ig-refresh.timer`:
```ini
[Unit]
Description=Daily IG token refresh
[Timer]
OnCalendar=*-*-* 04:00:00
Persistent=true
[Install]
WantedBy=timers.target
```

`reel-metrics-sync.service`:
```ini
[Unit]
Description=Sync published reel metrics into SaaS Maker
[Service]
Type=oneshot
User=reel
WorkingDirectory=/home/reel/reel-pipeline
EnvironmentFile=/home/reel/reel-pipeline/.env
ExecStart=/usr/bin/npm run sync:metrics
```

`reel-metrics-sync.timer`:
```ini
[Unit]
Description=Daily reel metrics sync
[Timer]
OnCalendar=*-*-* 09:30:00
Persistent=true
[Install]
WantedBy=timers.target
```

Enable:
```bash
sudo touch /var/log/reel-autopilot.log /var/log/reel-autopilot.err
sudo chown reel:reel /var/log/reel-autopilot.*
sudo systemctl daemon-reload
sudo systemctl enable --now reel-autopilot.service reel-ig-refresh.timer reel-metrics-sync.timer
```

Watch:
```bash
sudo journalctl -u reel-autopilot -f
sudo systemctl list-timers reel-ig-refresh.timer reel-metrics-sync.timer
```

## M1 16GB Pro setup (zero-cost fallback)

Same pattern as Hetzner but with launchd. `.env` lives in the repo root; node lives in homebrew.

`~/Library/LaunchAgents/com.fleet.reel-autopilot.plist`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.fleet.reel-autopilot</string>
  <key>WorkingDirectory</key><string>/Users/sarthak/Desktop/fleet/reel-pipeline</string>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/Users/sarthak/.cargo/bin</string></dict>
  <key>ProgramArguments</key>
  <array>
    <string>/Users/sarthak/.cargo/bin/cargo</string>
    <string>run</string>
    <string>--quiet</string>
    <string>--manifest-path</string>
    <string>reel/Cargo.toml</string>
    <string>--</string>
    <string>autopilot</string>
    <string>--execute</string>
    <string>--repo-root</string>
    <string>.</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/tmp/reel-autopilot.log</string>
  <key>StandardErrorPath</key><string>/tmp/reel-autopilot.err</string>
</dict>
</plist>
```

`~/Library/LaunchAgents/com.fleet.reel-ig-refresh.plist`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.fleet.reel-ig-refresh</string>
  <key>WorkingDirectory</key><string>/Users/sarthak/Desktop/fleet/reel-pipeline</string>
  <key>ProgramArguments</key>
  <array>
    <string>/opt/homebrew/bin/node</string>
    <string>scripts/refresh-instagram-tokens.js</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>4</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardOutPath</key><string>/tmp/reel-ig-refresh.log</string>
  <key>StandardErrorPath</key><string>/tmp/reel-ig-refresh.err</string>
</dict>
</plist>
```

`~/Library/LaunchAgents/com.fleet.reel-metrics-sync.plist`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.fleet.reel-metrics-sync</string>
  <key>WorkingDirectory</key><string>/Users/sarthak/Desktop/fleet/reel-pipeline</string>
  <key>ProgramArguments</key>
  <array>
    <string>/opt/homebrew/bin/npm</string>
    <string>run</string>
    <string>sync:metrics</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>9</integer><key>Minute</key><integer>30</integer></dict>
  <key>StandardOutPath</key><string>/tmp/reel-metrics-sync.log</string>
  <key>StandardErrorPath</key><string>/tmp/reel-metrics-sync.err</string>
</dict>
</plist>
```

Load:
```bash
launchctl load -w ~/Library/LaunchAgents/com.fleet.reel-autopilot.plist
launchctl load -w ~/Library/LaunchAgents/com.fleet.reel-ig-refresh.plist
launchctl load -w ~/Library/LaunchAgents/com.fleet.reel-metrics-sync.plist
```

Pin `PIPELINE_RENDER_CONCURRENCY=1` on the M1. Higher will thrash.

## Temporary M5 validation

For wiring runs only — not a persistent home. Foreground the Rust autopilot daemon so it dies when you close iTerm:

```bash
cargo run --quiet --manifest-path reel/Cargo.toml -- autopilot --execute --repo-root .            # daemon
cargo run --quiet --manifest-path reel/Cargo.toml -- autopilot --once --execute --repo-root .     # one tick, exit
npm run autopilot:dry          # dry-run one/loop (prints intended actions, no backend calls)
```

Don't install the plist on M5. The point is leaving no resident process.

## Verify the loop on M5 (today)

Goal: prove SaaS Maker → render → post end-to-end without touching real SaaS Maker data. Uses fixture pending posts and a real YouTube upload to a throwaway channel, all set to Private.

**Total time: ~30 min** (most of it browser work).

### Step 1 — Create a YT Brand Account (~3 min)

1. youtube.com → click your avatar → **Switch account** → **Create a new channel**.
2. Name it "Reel Pipeline Test" (or anything throwaway).
3. Confirm you can see it in the channel switcher.

This avoids touching the real tutoring channel until the loop is proven. Owned by your existing Google login, so no new account to manage.

### Step 2 — GCP OAuth client (~20 min)

1. console.cloud.google.com → new project (or reuse one).
2. APIs & Services → enable **YouTube Data API v3**.
3. OAuth consent screen → External → Testing mode → add yourself as a test user.
4. Credentials → **Create OAuth Client ID** → **Web application** → add `http://127.0.0.1:8765/oauth/callback` as Authorized redirect URI.
5. Copy the Client ID + Client Secret.

### Step 3 — Mint the refresh token (~2 min)

```bash
cd /Users/sarthak/Desktop/fleet/reel-pipeline
cp .env.example .env   # only if .env doesn't exist yet
# Edit .env: set YT_TUTORING_CLIENT_ID and YT_TUTORING_CLIENT_SECRET

YT_TUTORING_CLIENT_ID=... YT_TUTORING_CLIENT_SECRET=... npm run yt:bootstrap
```

Opens a browser. Pick the **"Reel Pipeline Test"** channel when Google asks which account to use. Script prints the refresh token; paste into `.env` as `YT_TUTORING_REFRESH_TOKEN`.

### Step 4 — Wire the accounts config (~1 min)

```bash
cp config/social-accounts.example.json config/social-accounts.json
```

Edit `config/social-accounts.json` and **remove the `instagram` block** for this first run (we're verifying YT-only):

```json
{
  "youtube": {
    "tutoring": {
      "clientIdEnv": "YT_TUTORING_CLIENT_ID",
      "clientSecretEnv": "YT_TUTORING_CLIENT_SECRET",
      "refreshTokenEnv": "YT_TUTORING_REFRESH_TOKEN",
      "defaultPrivacy": "private",
      "categoryId": "27",
      "projects": ["tutoring-q3"],
      "default": true
    }
  },
  "instagram": {}
}
```

### Step 5 — Generate the test clip (~5 sec)

```bash
ffmpeg -f lavfi -i color=c=black:s=1080x1920:d=2 \
       -f lavfi -i "sine=frequency=440:duration=2" \
       -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest \
       test/fixtures/test-clip.mp4
```

2-second 9:16 black-frame clip with a sine-wave audio track. ~30KB. Gitignored.

### Step 6 — Run the loop once

```bash
cargo run --quiet --manifest-path reel/Cargo.toml -- \
  autopilot --once --execute --repo-root . \
  --fixture test/fixtures/saas-maker-pending.json
```

### What success looks like

The Rust autopilot logs each phase and prints a tick summary, e.g.:

```
[..] intake: 1/1 past hold window
[..] render: scanning accepted marketing posts
[..] post: posting ready marketing videos
✓ tick complete: accepted=1 rendered=1 posted=1
```

Then on **studio.youtube.com** for the "Reel Pipeline Test" channel: a new video titled "Verify clip: aged pending YT", visibility **Private**.

### What it proves

- ✓ Fixture client is wired correctly
- ✓ Auto-accept logic respects the hold window (`fixture-fresh-yt` stays pending — that's the guardrail working)
- ✓ Render skip path works (asset_url already present, so render is a no-op)
- ✓ Account routing picks the `tutoring` account by `project_slug` match
- ✓ YouTube OAuth + resumable upload work end-to-end
- ✓ Posting marks `status=sent` on the fixture client

### Cleanup

```bash
# Delete the Private upload from studio.youtube.com (manual)
# Stop the autopilot if running as daemon
launchctl unload ~/Library/LaunchAgents/com.fleet.reel-autopilot.plist 2>/dev/null
# Or just Ctrl-C the foreground process
```

### When the verify fails

Walk the message — the autopilot logs the phase that broke:
- `missing SAASMAKER_SESSION_TOKEN` → forgot `--fixture`; the live client requires the token, fixture mode doesn't
- `env var YT_TUTORING_REFRESH_TOKEN is not set` → didn't paste the token into `.env`, or `.env` not loaded (run `source .env` first or use `dotenv-cli`)
- `YouTube token refresh failed 400` → the GCP OAuth client redirect URI doesn't match `http://127.0.0.1:8765/oauth/callback` exactly
- `YouTube resumable init failed 403` → consent screen still says "Testing" but your Google account isn't on the test-users list, or the YT Data API isn't enabled on this project
- `ENOENT … test/fixtures/test-clip.mp4` → step 5 didn't run; re-run the ffmpeg command

### Next after a clean YT verify

1. Stop the autopilot (`Ctrl-C` or unload the plist).
2. Decide on real SaaS Maker auth (we deferred the CLI flow — paste a session token in `.env` once you've fetched it from the SaaS Maker dashboard, or implement the CLI auth path as a follow-up).
3. Re-run the autopilot **without** `--fixture` against live SaaS Maker. The same loop, just polling real data.
4. Once that's stable, do the [Instagram setup](./instagram-setup.md) and re-add the `instagram` block to `config/social-accounts.json`.

## Secret sync between hosts

Two files have to move with the pipeline: `.env` and `config/social-accounts.json`. Pick one strategy:

| Strategy | Setup | Per-rotation cost | Auditability |
|---|---|---|---|
| **1Password CLI** (`op inject`) | ~30 min | One command, no manual edits | Versioned, sharable |
| **dotenv-vault** | ~15 min | `npx dotenv-vault push/pull` | OK but vendor lock-in |
| **scp from a known-good box** | 0 min | Manual edit + re-scp | None — easy to drift |
| **Bitwarden Secrets Manager** | ~30 min | CLI command | Versioned |

Recommendation: **1Password CLI** if you already use 1Password (you can run `op inject -i .env.tpl -o .env` so the template is committable and secrets render in place). Otherwise scp is fine until you have a second host to keep in sync, at which point manual drift starts hurting.

Don't commit `.env` or `config/social-accounts.json` to a private GitHub repo even by accident — the `.gitignore` already excludes them. Recheck after every clone.

## Migration playbook

When you move from host A → host B (e.g., M5 → Hetzner):

1. **On host A**: the autopilot daemon is stopped (`launchctl unload …` or `systemctl stop …`).
2. **On host B**: clone the repo, `npm ci`, sync `.env` + `config/social-accounts.json` via your chosen strategy.
3. **On host B**: `cargo run --quiet --manifest-path reel/Cargo.toml -- autopilot --once --execute --repo-root .` — should report `accepted=0 rendered=0 posted=0` if A finished its queue, or process the remainder.
4. **On host B**: enable the supervisor (systemd or launchd).
5. **On host A**: leave the repo in place for 1 week as rollback. Then remove.

The pipeline keeps no host-local state that matters. `artifacts/` is regenerable, `tmp/` is junk. Only `.env` + `config/social-accounts.json` are precious, and those should already be in your secret store.

## Sanity checks per host

After install on any host, run in order:
```bash
npm test                       # node --test + cargo test should pass
cargo run --quiet --manifest-path reel/Cargo.toml -- autopilot --once --execute --repo-root .   # one full tick against live SaaS Maker
npm run sync:metrics           # backfill latest post metrics into SaaS Maker notes
sudo journalctl -u reel-autopilot --since "5 minutes ago"   # linux
tail -50 /tmp/reel-autopilot.log                            # mac
```

If the tick logs `intake: 0/0 past hold window` and exits cleanly, you're done. Otherwise the error names the missing piece (env var, account config entry, network reach).
