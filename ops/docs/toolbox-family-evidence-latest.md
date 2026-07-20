# Significant Hobbies Toolbox — family evidence

Generated 2026-07-19T16:07:39.790Z by `toolbox-family-evidence.mjs`. Do not edit by hand.

**Family status:** `pass` (one child failure does not mark family failed: true).

| product | runtime | build | live | indexing | errors | activation | jobs |
|---|---|---|---|---|---|---|---|
| significanthobbies | opennext-worker | unknown | unknown | unknown | unknown | unknown | — |
| reader | spa-hono-worker | unknown | unknown | unknown | unknown | unknown | reader-weekly-quality:unknown |
| anime-list | spa-hono-pages | unknown | unknown | unknown | unknown | unknown | anime-daily-sync:unknown; anime-quarterly-full-refresh:unknown; manga-quarterly-full-refresh:unknown |
| swe-interview-prep | spa-pages-functions | unknown | unknown | unknown | unknown | unknown | swe-library-refresh:unknown |
| looptv | next-static-pages | unknown | unknown | unknown | unknown | unknown | looptv-biweekly-catalog-fetch:unknown; looptv-biweekly-catalog-build:unknown |
| chess | spa-static-pages | unknown | unknown | unknown | unknown | unknown | — |

## Per-child status

- **significanthobbies** — unknown (evidence-incomplete)
- **reader** — unknown (evidence-incomplete)
- **anime-list** — unknown (evidence-incomplete)
- **swe-interview-prep** — unknown (evidence-incomplete)
- **looptv** — unknown (evidence-incomplete)
- **chess** — unknown (evidence-incomplete)

## Digest

- Policy: `deduplicate-routine-failures`
- Failing: —
- Stale: —
- Unknown: significanthobbies, reader, anime-list, swe-interview-prep, looptv, chess
- Page: false (only on data/security risk or prolonged outage)

## Activation definitions

- **significanthobbies** (`hobby-public-item`): A signed-in user creates or completes a Living-dimension public item (hobby path, bucket-list entry, side quest, timeline event, or public profile) — not a Daily private journal entry.
- **reader** (`reading-library-action`): A signed-in user saves an article or PDF, or completes an annotation/AI-chat turn over saved material. Aggregate count only — never article bodies, annotations, or chat content.
- **anime-list** (`discovery-list-action`): A signed-in user adds a title to a personal watchlist, saves a search, or adds a title to a collection. Aggregate count only — never the titles on a personal watchlist.
- **swe-interview-prep** (`learning-drill-action`): A signed-in user completes a drill, a Playground run with a Feynman Gate pass, or a spaced-repetition review. Aggregate count and FSRS mastery delta only — never answers, notes, or prompts.
- **looptv** (`playback-action`): A visitor starts playback on a station and the player reaches a meaningful watch threshold (e.g. 30s sustained play). Page availability alone is NOT activation — see spec scenario 'LoopTV loads but cannot play'.
- **chess** (`game-coaching-action`): A visitor completes a game (checkmate, draw, or resignation) OR requests and receives at least one AI coaching explanation. Aggregate count only — never PGN move history, saved games, or coaching conversation bodies.

## Privacy exclusions

- **significanthobbies**: daily-journal-bodies, habit-checkin-answers, private-notes, user-identifying-state, credentials
- **reader**: article-bodies, pdf-content, annotations, ai-chat-prompts, ai-chat-completions, retrieved-chunks, user-library-contents, credentials
- **anime-list**: personal-watchlists, saved-searches, collections-contents, user-identifying-state, credentials
- **swe-interview-prep**: learning-answers, drill-submissions, notes, ai-prompts, ai-completions, progress-per-user, credentials
- **looptv**: watched-state-localStorage, user-identifying-state, credentials
- **chess**: saved-games, pgn-move-history, coaching-conversation-bodies, localStorage-state, credentials

_Registry: fleet.significant-hobbies-toolbox.v1 v1, 6 products. Live probes not wired — every status is `unknown` until an adapter is connected._
