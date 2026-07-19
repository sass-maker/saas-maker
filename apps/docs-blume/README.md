# SaaS Maker package documentation (Blume)

AI-ready docs powered by [Blume](https://github.com/haydenbleasel/blume).

Blume is the **presentation and search layer only**. The committed Markdown at
the repository root in [`docs/`](../../docs/) is the source of truth. Do not
author content inside this package — edit `docs/` and rebuild.

`blume.config.ts` points `content.root` at `../../docs`, but its fixed exclusion
list makes only the public package/product sections render: getting started,
API, SDK/CLI, services, widgets, and generated OpenAPI documentation. Internal
Foundry architecture, operations, plans, status, and learnings cannot be enabled
through an environment flag. See [`docs/README.md`](../../docs/README.md) for
the complete private repository knowledge layout.

The production target is `https://packages.sassmaker.com`. Deployment remains
manual and requires the normal release gate; a build does not publish anything.

```bash
npm install
npm run build   # → dist/ (llms.txt, llms-full.txt, sitemap, per-page .md)
npm run dev
```

`dist/` and `.blume/` are build artifacts — they are gitignored and never
committed.
