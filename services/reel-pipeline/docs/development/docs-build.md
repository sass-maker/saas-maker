# Docs Build (Blume)

Blume is the presentation and search layer for this repo's Markdown
documentation. **The committed Markdown under `docs/` (and the root
`README.md`, `AGENTS.md`, `STATUS.md`, `PROJECT_STATUS.md`) is the source of
truth.** Blume only renders it. Never edit generated files under `.blume/` or
`dist/`.

## Config

`blume.config.ts` at the repo root points Blume at `docs/` as its content
root. Navigation, search, theming, OG images, and SEO are inferred from the
files — there is no separate nav file to keep in sync.

## One-time setup

Blume needs Node ≥ 22.12, but this repo targets Node ≥ 20, so Blume is **not**
in `devDependencies`. Install it on demand in one of three ways:

```bash
# Option A — global install (Node 22.12+ only)
npm install -g blume@1.0.3

# Option B — npx (no install)
npx blume@1.0.3 dev

# Option C — local devDep in a Node 22+ environment
npm install -D blume@1.0.3
```

The self-contained structure/link validator (`npm run docs:validate`) runs
without Blume and is what CI uses. The `docs:dev`/`docs:build`/`docs:links`
scripts require Blume to be on PATH.

## Commands

```bash
npm run docs:validate   # structure + internal link check (no Blume needed)
npm run docs:links      # blume validate (internal, anchor, asset, external links)
npm run docs:dev        # blume dev (hot reload, http://localhost:4321)
npm run docs:build      # blume build → static HTML in dist/
npm run docs:preview    # blume preview the last build
```

`blume build --strict` fails the build on diagnostic errors; the CI docs job
uses `npm run docs:validate` (self-contained) and `npm run docs:links` when
Blume is installed.

## Generated artifacts (gitignored)

- `.blume/` — the hidden Astro runtime Blume regenerates on every run.
- `dist/` — the static build output.
- `.blume-verify/` — throwaway runtime used by `blume build --isolated`.

Never commit these. They are already in `.gitignore`.

## Maintenance rules

- Add new pages under `docs/` following the existing structure
  (see [`docs/index.md`](../index.md)).
- Update the source Markdown, not any generated file.
- Keep internal links relative and valid; `npm run docs:validate` enforces this
  in CI.
- If a page should not be published, exclude it via `content.exclude` in
  `blume.config.ts` rather than deleting it.
