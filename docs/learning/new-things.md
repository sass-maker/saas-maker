# New things to learn — reel-pipeline

Novel AI + video tech stacked in one pipeline: Workers orchestrating Python engines, Gemini-driven editing, fal GPU bursts, and TTS dubbing — all glued by FFmpeg.

---

## Workers → Long-Running Python Job Interop
- What: CF Workers default to a 30 s CPU limit (max 5 min on paid plan); Python video renders take minutes — solved via async job queue (poll `/tasks/:id`) over HTTP to a Docker/local Python server.
- Why here: TBD
- Gotcha (from code): The Worker itself (`src/worker/index.js`) only does synchronous R2 ops and returns immediately; the blocking poll loop (`src/pipeline.js:195-204`) runs in the Node server, not the Worker. If that loop were ever ported into a Worker handler without Durable Objects, the 30 s default would silently kill it mid-poll.
- Source: https://developers.cloudflare.com/workers/platform/limits/

## Engine Pinning Strategy
- What: Each engine submodule is locked to an exact commit in `engine-pins.md`; upgrades require a passing canary render on a branch first.
- Why here: TBD
- Gotcha (from code): `docs/engine-pins.md:8-9` confirms `openshorts` (`fe87af6`) and `reel-maker` (`92b6268`) are on `heads/main` (floating ref), while MoneyPrinterTurbo is on tagged `v1.2.8` — any `git submodule update --remote` silently advances the two floating engines without a canary.
- Source: https://git-scm.com/book/en/v2/Git-Tools-Submodules

## Gemini for Vision + Dynamic FFmpeg Generation
- What: Gemini 2.0 Flash analyzes video frames to detect viral moments AND generates FFmpeg filter strings on the fly (`editor.py` in OpenShorts).
- Why here: TBD
- Gotcha (from code): `editor.py:279-370` runs a best-effort sanitizer (`_sanitize_filter_string`) and a zoompan size enforcer before calling FFmpeg, but the filter string still goes straight to `-vf` via `subprocess.run`. A hallucinated unknown filter name (e.g. `colorfix`) crashes FFmpeg with a non-zero exit and raises `CalledProcessError` — no silent fallback to the original clip.
- Source: https://ai.google.dev/api/generate-content

## fal.ai Latency/Pricing Model
- What: fal.ai is a serverless GPU inference platform — billing is per-second of execution for serverless endpoints, or per-hour fixed rate for dedicated Compute; a multi-layer caching system reduces cold starts over time.
- Why here: TBD
- Gotcha: Cold start latency is real but not billed separately — you pay for execution seconds only while a runner is active; setting `min_concurrency > 0` keeps runners warm at the cost of idle GPU time.
- Source: https://fal.ai/docs

## ElevenLabs Dubbing API
- What: ElevenLabs `/v1/dubbing` endpoint translates and re-voices a video in 30+ languages, preserving the original speaker's emotion and timing; the result is polled until ready, then fetched as a separate audio track.
- Why here: TBD
- Gotcha: Dubbing is async — `elevenlabs.dubbing.create()` returns a `dubbing_id` and you must poll status before downloading; forgetting the poll step yields a 404 on the audio fetch.
- Source: https://elevenlabs.io/docs/api-reference/dubbing

## MoneyPrinterTurbo — What's Special
- What: MIT-licensed Python engine that chains Edge TTS → stock footage fetch → FFmpeg/MoviePy compose → subtitle burn in one `POST /api/v1/videos` call; no GPU required.
- Why here: TBD
- Gotcha (from code): The engine is the "cheap path" default precisely because the canary can run with locally-generated fixtures — no API quota needed for first verification.
- Source: https://github.com/harry0703/MoneyPrinterTurbo

## Remotion (React → Video)
- What: Remotion renders React component trees frame-by-frame to MP4 using headless Chromium; every animation is expressed as React state over time, making video edits feel like UI development.
- Why here: TBD
- Gotcha: Remotion Lambda cold renders spawn a Chromium process per composition; local preview is cheap but cloud rendering bills per Chromium-second — a missing `cancelRender` on abort leaves orphaned Lambda invocations.
- Source: https://remotion.dev/docs

## MoviePy (Python Video Editing)
- What: Python library wrapping FFmpeg with a clip/effect/composite object model; used inside MoneyPrinterTurbo for programmatic assembly.
- Why here: TBD
- Gotcha: MoviePy v2.0 (Jan 2025) introduced breaking changes from v1.x — MoneyPrinterTurbo's pinned commit (`v1.2.8`) ships its own requirements; mixing a system-wide v2 install with the engine's v1 expectations breaks silently on effect chaining.
- Source: https://zulko.github.io/moviepy/

## FFmpeg Compositing Basics
- What: FFmpeg's `filter_complex` graph lets you layer, crop, scale, and subtitle multiple video/audio streams in a single pass without temp files.
- Why here: TBD
- Source: https://ffmpeg.org/ffmpeg-filters.html

## OpenShorts — UGC + Subject Tracking
- What: OpenShorts adds MediaPipe face detection + YOLOv8 fallback to auto-crop vertical 9:16 from wide footage, with a "Heavy Tripod" stabilizer to prevent jitter.
- Why here: TBD
- Gotcha (from code): Adapter deliberately does not invoke UGC/fal/ElevenLabs/autopost — it writes a guarded job spec only to avoid accidental paid-service calls.
- Source: https://github.com/JonasLoos/openshorts

## R2 for Asset Hosting
- What: Cloudflare R2 is S3-compatible object storage with zero egress fees; MP4s, thumbnails, and captions land here before being attached to the marketing queue item.
- Why here: TBD
- Source: https://developers.cloudflare.com/r2/

## Gemini Viral Moment Detection
- What: Gemini identifies 3–15 timestamped "viral moments" (15–60 s each) from a transcript + frames, returning structured JSON used to slice clips with FFmpeg.
- Why here: TBD
- Source: https://ai.google.dev/api/generate-content

## Gemini File API — Video Upload + Processing Poll
- What: Before Gemini can analyze a video it must be uploaded via `client.files.upload()` and then polled until `file.state == "ACTIVE"`; only then can the file reference be passed to `generate_content`.
- Why here: TBD
- Gotcha (from code): `editor.py:30-38` polls in a blocking `while True` with a 2 s sleep — there is no timeout guard, so a video stuck in `PROCESSING` state hangs the entire render worker indefinitely.
- Source: https://ai.google.dev/gemini-api/docs/files
