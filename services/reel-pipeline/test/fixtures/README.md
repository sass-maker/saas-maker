# Verify fixtures

Fake SaaS Maker pending posts + a generated test clip used by the M5 loop verify.

## test-clip.mp4 — one-time generation

The `saas-maker-pending.json` fixture points at `./test/fixtures/test-clip.mp4`. Generate it once with ffmpeg (~2 seconds of 9:16 black-frame video with a sine-wave audio track, ~30KB):

```bash
ffmpeg -f lavfi -i color=c=black:s=1080x1920:d=2 \
       -f lavfi -i "sine=frequency=440:duration=2" \
       -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest \
       test/fixtures/test-clip.mp4
```

Re-run if it ever gets deleted. The file is gitignored (binary, regenerable) — don't commit it.

## saas-maker-pending.json

Two seeded posts:

| ID | created_at | Expected behavior |
|---|---|---|
| `fixture-aged-yt` | 2020-01-01 (far past) | Past the hold window → autopilot auto-accepts → uploads to your test YT channel as Private |
| `fixture-fresh-yt` | 2099-01-01 (far future) | Inside the hold window → autopilot leaves it `pending` → never posts |

Verifies three things at once: auto-accept on aged posts, hold-window protection on fresh ones, real YT upload via the configured OAuth account.
