# Development Setup

## Fresh clone

The render path shells out to `node scripts/render-pro.js`, which depends on
the engine git submodules. Clone with submodules, or initialize after cloning:

```bash
git clone --recurse-submodules <repo-url>
# or, after cloning without submodules:
git submodule update --init --recursive
```

Without submodules, render fails with missing `engines/*`.

## Prerequisites

- **Node ≥ 20** (`engines.node` in `package.json`); Node 22 for Blume docs.
- **Rust stable** (for the `reel/` crate; `cargo test` runs in `npm test`).
- **ffmpeg + ffprobe** on PATH (or set `FFMPEG_PATH`/`FFPROBE_PATH`).
- **Playwright Chromium** for product-proof capture and ASCII raster paths:
  `npx playwright install chromium`.
- **Python 3.11** only if running MoneyPrinterTurbo locally
  (`engines/MoneyPrinterTurbo`).
- **`uvx`** for Edge TTS in `render-pro.js`.

## Install

```bash
npm ci
```

This installs Node deps; Rust deps resolve on first `cargo` run.

## Environment

Do not commit `.env` files or provider tokens. Copy `.env.example` as the
non-secret template. Expected variables when connecting to real SaaS Maker /
providers:

- `SAASMAKER_API_URL` (default `https://api.sassmaker.com` — double-s brand)
- `SAASMAKER_SESSION_TOKEN` for session-auth Marketing Queue access
- `MONEYPRINTER_API_URL` (default `http://127.0.0.1:8080`)
- `GROK_VIDEO_ASSET_DIR` for local Grok/Imagine MP4 inserts
- Provider-specific keys stored in the relevant engine config, not in this repo
- Multi-account social posting: `config/social-accounts.json` (gitignored)
  references env vars by name; see `config/social-accounts.example.json`

The local Node API stores review drafts under `.reel-pipeline/reels` by
default. The deployed Cloudflare Worker stores review drafts as JSON objects
in the configured R2 bucket under `reel-requests/`.

## First run

```bash
npm run dev          # local control API on http://127.0.0.1:4317
curl -sS http://127.0.0.1:4317/health
```

Open the root page to submit an anonymous brand URL, `/review` for the swipe
review UI, or `/studio` for the content studio.

## Verify

```bash
npm test             # Node tests + cargo test
npm run smoke:mock   # no-dependency end-to-end smoke
npm run ready:local  # top-level generation-cases readiness
```

See [`testing.md`](./testing.md) for the full test/smoke/readiness matrix and
[`commands.md`](./commands.md) for the canonical command reference.
