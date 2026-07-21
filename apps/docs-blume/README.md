# SaaS Maker feedback documentation (Blume)

AI-ready docs powered by [Blume](https://github.com/haydenbleasel/blume).

Blume is the **presentation and search layer only**. The committed Markdown at
the repository root in [`docs/`](../../docs/) is the source of truth. Do not
author content inside this package — edit `docs/` and rebuild.

`blume.config.ts` points `content.root` at `../../docs`. That compact tree covers
only the feedback package, project keys, and retained API. Fleet operations and
other products are documented in their owning repositories.

The canonical production target is `https://saas-maker-packages.pages.dev`. Deployment remains
manual and requires the normal release gate; a build does not publish anything.

```bash
npm install
npm run build   # → dist/ (llms.txt, llms-full.txt, sitemap, per-page .md)
npm run dev
```

`dist/` and `.blume/` are build artifacts — they are gitignored and never
committed.
