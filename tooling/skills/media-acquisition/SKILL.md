---
name: media-acquisition
description: Inspect or acquire public audio, video, subtitles, thumbnails, and media metadata with yt-dlp for an explicit research, archival, or product workflow; not for playback, private content, DRM bypass, or account scraping.
---

# Media acquisition

Use `yt-dlp` for reproducible public-media metadata and downloads. Inspect
metadata first, download only what the request actually needs, and preserve
repository-local media pipelines when they already own the workflow.

## Boundaries

- A public URL is not proof that every reuse is permitted. Confirm that the
  requested download and intended use are authorized by the user or the
  repository's documented workflow.
- Do not handle account passwords, cookies, browser profiles, private links,
  paywalls, DRM, or geo/access-control bypasses.
- Do not install `yt-dlp`, `youtube-transcript-api`, FFmpeg, browser-cookie helpers, or plugins without
  explicit approval. If a required executable is absent, report it as
  unavailable.
- Instagram acquisition is not enabled by default. Reconsider Instaloader only
  after a concrete public-content workflow and its account/rate-limit boundary
  have been approved.

## Prefer existing pipelines

Read the nearest `AGENTS.md`, status file, and media scripts first. LoopTV and
High Signal already have project-specific yt-dlp behavior; run or improve those
scripts instead of reconstructing their commands here.

## Workflow

1. Record the source URL without sensitive query parameters and check
   `yt-dlp --version`.
2. Inspect before downloading:
   - one item: `yt-dlp --simulate --dump-single-json <url>`;
   - playlist/channel inventory: `yt-dlp --flat-playlist --dump-json <url>`;
   - subtitle availability: `yt-dlp --list-subs <url>`;
   - format availability: `yt-dlp --list-formats <url>`.
3. Select the smallest artifact that satisfies the task. Metadata-only and
   subtitle-only work should not download media bytes.
4. For an approved download, use an explicit destination and output template.
   Prefer `--no-overwrites`; use `--download-archive` only for a documented,
   persistent pipeline.
5. Limit playlists, retries, and request rate. Stop after repeated `429`, login,
   or extractor errors rather than escalating to cookies or bypasses.
6. Validate the produced files or JSON before reporting success. When piping
   yt-dlp output through `jq` or another consumer, enable shell `pipefail` or
   check yt-dlp's status separately so a successful consumer cannot hide an
   extractor failure.

Do not paste large metadata documents into the conversation. Extract the
fields needed for the task and retain full output only when requested.

## Optional YouTube transcript backup

Keep `yt-dlp` as the default, including subtitle-only retrieval. When a public
YouTube transcript task encounters an extractor-specific failure or yt-dlp is
unavailable, use an already-installed
[`youtube-transcript-api`](https://github.com/jdepoix/youtube-transcript-api)
as a bounded backup. It retrieves existing captions, not speech-to-text for
videos without captions; it does not replace media or metadata acquisition.

- Pass the video ID, not the URL. For example:
  `youtube_transcript_api VIDEO_ID --languages en --format json`.
- Select the requested language explicitly; prefer manual captions when
  available. Preserve timestamps and label generated or translated captions.
- Check the exit status and validate nonempty text plus numeric start/duration
  fields. Record the backend version and why the backup was selected.
- Do not switch backends to evade rate limits, IP blocks, login requirements,
  or access restrictions. Stop and report those states; do not add proxies or
  cookies. This library uses undocumented YouTube interfaces and is not a
  guaranteed reliability fallback.
- If absent, report the backup as unavailable and ask before installation.

## Receipt

Report:

- backend name/version and source host (including fallback reason, if used);
- mode: metadata, subtitles, thumbnails, audio, video, or mixed;
- selection rules and item limit;
- items inspected, written, skipped, and failed;
- output directory and archive file, if any;
- whether FFmpeg/post-processing ran;
- access, rights, or rate-limit constraints;
- validation performed.

Separate discovery, download, post-processing, and downstream publication.
Acquiring a file does not authorize publishing it.
