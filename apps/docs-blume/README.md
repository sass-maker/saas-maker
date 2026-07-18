# Foundry Manual (Blume)

AI-ready docs powered by [Blume](https://github.com/haydenbleasel/blume).

Blume is the **presentation and search layer only**. The committed Markdown at
the repository root in [`docs/`](../../docs/) is the source of truth. Do not
author content inside this package — edit `docs/` and rebuild.

`blume.config.ts` points `content.root` at `../../docs`, so every page rendered
here is the canonical Markdown from the repo knowledge tree. See
[`docs/README.md`](../../docs/README.md) for the documentation layout and
maintenance rules.

```bash
npm install
npm run build   # → dist/ (llms.txt, llms-full.txt, sitemap, per-page .md)
npm run dev
```

`dist/` and `.blume/` are build artifacts — they are gitignored and never
committed.
