# Blume docs in the fleet

[Blume](https://github.com/haydenbleasel/blume) is the preferred stack for
**large, focused documentation sites** that need strong AI + SEO indexing
without custom Worker GEO plumbing.

## Installed packages

| Package | Path | Intended domain | Pages |
|---|---|---|---|
| posttrainllm docs | `posttrainllm/docs-site` | `docs.posttrainllm.com` | ~286 |
| Foundry Manual | `saas-maker/apps/docs-blume` | `docs.sassmaker.com` (cut over) | ~20 |
| AI Gateway docs | `free-ai/docs-blume` | `docs.ai-gateway.sassmaker.com` | ~18 |

Each build emits: `llms.txt`, `llms-full.txt`, per-page `.md` / `.mdx`,
`sitemap.xml`, `robots.txt`, `agent-readability.json`.

## Commands

```bash
cd <package>
pnpm install   # or npm install (saas-maker/free-ai use npm)
pnpm build     # → dist/
pnpm dev
```

Node **≥ 22.12**. Use `shamefully-hoist=true` in `.npmrc` when using pnpm so
Blume can resolve nested Astro deps.

## Cut-over checklist

1. Create Cloudflare Pages project (or repoint existing) at package root.
2. Build: `pnpm build` / `npm run build`; output `dist`.
3. Attach custom domain from the table above.
4. Submit `sitemap.xml` in Search Console.
5. Spot-check: `/llms.txt`, `/index.md`, `/agent-readability.json`.

## What stays non-Blume

Product apps (RolePatch tools, High Signal case studies, etc.) keep Next +
`agent-surfaces` / edge cache. Blume is for **docs corpora**, not marketing
app shells.

## Optional later

- `deployment.output: "server"` + Cloudflare adapter for Ask AI / MCP
- Point Ask AI at fleet free-ai / OpenRouter
