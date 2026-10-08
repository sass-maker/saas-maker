# Ahrefs Site Audit health — canonical roots

Generated 2026-10-02T13:19:23.011Z.

**Status: blocked — missing-api-key.**

AHREFS_API_KEY is required for Ahrefs Site Audit project health

No Site Audit metric is reported as zero. Domain Rating, Fleet on-page checks, and PageSpeed remain separate metrics.


## Local crawl and source actions

Generated 2026-10-02T13:16:21.184Z from each root sitemap. Agent surfaces such as Markdown alternates, `llms.txt`, and `/api/*` are skipped. This is the remediation input when Ahrefs Site Audit is unavailable.

**Crawled 280 URLs across 11 roots. 0 error actions, 0 warnings.**

| brand | severity | issue | url | action |
|---|---|---|---|---|
| – | – | – | – | No source actions from the local crawl. |

Apply every **error** action in the owning source repository. Do not deploy. Do not invent review scores or ratings. Warnings may wait unless they share a page already being edited.

## Targeted live follow-up — 2026-10-02

The zero actions above apply only to the bounded on-page crawl, not to asset integrity or all internal links. Separate live checks reproduced defects outside that crawl's coverage:

- RolePatch `/pricing` and `/tools` serve cached HTML referencing 15 distinct JavaScript files that return 404. A fresh pricing query serves the current build, whose 15 scripts return 200. Local build-scoped cache and docs-link fixes are tracked in [RolePatch #78](https://github.com/Significant-Hobbies/rolepatch/issues/78).
- The portfolio links to a Cloudflare email-protection URL that returns 404 on all 13 sitemap pages. Local contact-link exclusions and a built-page regression check are tracked in [Portfolio #39](https://github.com/Significant-Hobbies/portfolio/issues/39).
- SaaS Maker's public directory email text is also rewritten into that 404 link. Local public-content exclusions and an invalid-sitemap guard are tracked in [SaaS Maker #171](https://github.com/sass-maker/saas-maker/issues/171).

These fixes are **local and tested, not deployed**. Ahrefs dashboard access remains unavailable, so remaining provider findings and a post-release recrawl are not verified. An HTML fallback at a sitemap URL is now a reported audit error, not an empty successful crawl.
