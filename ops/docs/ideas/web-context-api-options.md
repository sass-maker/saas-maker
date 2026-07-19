# Web Context API Options

Last reviewed: 2026-06-12

## Question

Build something like Context.dev / Firecrawl, or use existing tools and build the differentiated layer?

## Short Answer

Do not start by building a Firecrawl clone.

Use hosted or self-hosted crawl/scrape/search/browser tools for the plumbing, then build the product layer on top:

```text
domain -> company profile -> brand kit -> products -> pricing -> screenshots -> evidence-backed JSON
```

The crawler/rendering layer is expensive infrastructure: Chromium pools, queues, retries, JS waits, sitemap traversal, screenshots, blocked pages, timeouts, and usage accounting. The more valuable product surface is normalized, cached, evidence-backed market/company context.

## What These Products Are Doing

### Firecrawl-style layer

Firecrawl is mainly web data infrastructure for agents and apps:

- Search, scrape, map, crawl, batch scrape, monitor, parse, interact.
- Convert web pages into markdown, HTML, screenshots, or structured JSON.
- Handle JS rendering and browser-like extraction behind an API.
- Package crawling as credits, concurrency, SDKs, API keys, and hosted infra.

Use this layer rather than rebuilding it first.

### Context.dev-style layer

Context.dev is more of a typed enrichment API:

- Domain, company, email, ticker, URL, or transaction descriptor in.
- Brand/company/style/web context out.
- Logos, colors, fonts, styleguide, company profile, socials, screenshots, markdown, sitemap, industry codes, products, and schema-shaped extraction.

This is closer to the layer worth owning.

## Recommended Product Wedge

Build "Domain to Market Context":

```http
POST /v1/domain-context
{
  "domain": "example.com",
  "include": ["brand", "products", "pricing", "styleguide", "screenshots"]
}
```

Return:

```json
{
  "domain": "example.com",
  "brand": {
    "name": "Example",
    "description": "...",
    "colors": [],
    "logos": [],
    "socials": []
  },
  "products": [],
  "pricing": [],
  "styleguide": {
    "fonts": [],
    "tone": "unknown"
  },
  "evidence": [
    {
      "field": "pricing",
      "url": "https://example.com/pricing",
      "confidence": 0.86
    }
  ],
  "freshness": "2026-06-12T00:00:00Z"
}
```

Principles:

- Return `unknown` instead of hallucinating.
- Store evidence for every extracted field.
- Cache by domain and refresh stale domains.
- Keep raw HTML/markdown/screenshots separate from normalized records.
- Start with 20-50 known domains and compare outputs across vendors before building infra.

## No-Card Hosted Services To Try

These were checked from public pricing/docs pages on 2026-06-12. Free tiers change; verify before relying on them.

| Service | No-card free offer | Best use |
| --- | --- | --- |
| [Firecrawl](https://www.firecrawl.dev/pricing) | 1,000 credits/month, no card | General scrape/crawl/map/search/markdown/screenshots |
| [Tavily](https://docs.tavily.com/documentation/api-credits) | 1,000 credits/month, no card | Agent search, extract, map, crawl-lite |
| [Jina Reader](https://jina.ai/reader/) | Free Reader API, works without an API key at lower limits; free key has higher limits | URL/search to clean LLM-ready text |
| [Context.dev](https://www.context.dev/pricing) | 500 one-time API credits, no card | Brand/company enrichment benchmark |
| [ScrapingBee](https://www.scrapingbee.com/pricing/) | 1,000 free API credits, no card | Hosted scraping with JS/proxy/screenshot features |
| [Scrapfly](https://scrapfly.io/pricing) | 1,000 signup credits, no card, no time limit | Scrape, browser, screenshot, extraction, crawler |
| [Apify](https://apify.com/pricing) | Free plan with $5 platform/store credit, no card | Hosted actors, crawler workflows, marketplace scrapers |
| [Browserless](https://www.browserless.io/pricing) | Free plan, no card | Hosted Chromium/Playwright/Puppeteer/browser sessions |
| [HasData](https://hasdata.com/prices) | 1,000 API credits / 30-day trial, no card | Scraper APIs, SERP APIs, no-code scrapers |

First comparison set:

1. Firecrawl for crawl/scrape and screenshots.
2. Jina Reader for fast URL-to-markdown fallback.
3. Tavily for search/retrieval.
4. Context.dev for brand/entity benchmark.
5. Browserless only when real browser automation is required.

## Open Source / Self-Hosted Tools

Use these when hosted quotas, data residency, or custom logic become blockers.

| Tool | Role | Notes |
| --- | --- | --- |
| [Firecrawl](https://github.com/firecrawl/firecrawl) | Self-hosted web extraction API | Good first self-host target; check license and self-host feature gaps before production use. |
| [SearXNG](https://github.com/searxng/searxng) | Metasearch | Useful search backend beside self-hosted Firecrawl. |
| [Crawlee](https://crawlee.dev/) | Custom JS/Python crawling | Good when generic Firecrawl jobs are too blunt. |
| [Scrapy](https://scrapy.org/) | Mature Python crawling | Best for high-throughput mostly-HTML crawling. |
| [Trafilatura](https://github.com/adbar/trafilatura) | Main-text extraction | Use after fetching HTML to clean content. |
| [browser-use](https://github.com/browser-use/browser-use) | AI browser automation | Good for agentic browser flows, not bulk crawling. |
| [Stagehand](https://github.com/browserbase/stagehand) | Browser automation with natural-language actions | Useful for interactive workflows. |
| [Unstructured](https://github.com/Unstructured-IO/unstructured) | Document parsing | PDFs, DOCX, HTML docs, ingestion pipelines. |

## MVP Build Path

1. Pick 20-50 target domains.
2. Run each through Firecrawl, Jina Reader, Tavily, and Context.dev.
3. Store raw markdown, HTML, screenshots, and vendor outputs.
4. Define the normalized `domain_context` schema.
5. Write one extraction worker that:
   - normalizes the domain,
   - fetches homepage/pricing/about/product/docs/sitemap pages,
   - extracts brand, products, pricing, style tokens, screenshots,
   - validates output with a schema,
   - attaches evidence URLs and confidence.
6. Add cache/freshness:
   - fresh if checked within 30-90 days,
   - stale if older,
   - manual refresh endpoint later.
7. Add a small dashboard only after the object model is useful.

## When To Build More Infrastructure

Build or self-host crawler infrastructure only if:

- hosted API costs dominate the product,
- data cannot leave controlled infrastructure,
- vendor outputs are not reliable enough,
- the product needs custom crawl policy and scheduling,
- the business is actually selling scraping infrastructure.

Otherwise, keep crawler infrastructure as a dependency and own the enrichment layer.

## Revisit Checklist

- Do no-card free tiers still exist?
- Which vendor gave the best raw markdown?
- Which vendor gave the best screenshots?
- Which vendor produced the most reliable pricing/product data?
- Is the Context.dev brand output good enough to benchmark against?
- Is the target product "market context" or just "scraping infra"?
- Is there a fleet repo this should live in, or should it become a new project?
