# Source allowlist

This is the review map for every upstream operation. Anything absent is unavailable to the MCP caller.

| App | Approved source routes | Explicit exclusions |
| --- | --- | --- |
| Reader | `GET /api/mcp/reading`, `/api/mcp/reading/:id` | writes, sharing, PDF download, AI chat, credentials |
| Starboard | `GET /api/discover`, `/api/repos/:id?catalogOnly=1`, `/api/project-preview`, `/api/tools` | private GitHub data, saved projects, recommendations that require owner context, discussions/jobs/admin |
| High Signal | `GET https://api.highsignal.app/data/daily`, `/signals/:slug/evidence` | per-source browsing, raw article bodies, watchlists, review/delivery/admin/ingest/refresh/provider operations |
| Calorie | `GET /api/mcp/daily`, `/history`, `/foods`, `/cycles` | all `/api/app` mutations; medication and weight tables/fields |
| My Anime List | Native fixed catalog/detail/stats/random and owner-watchlist operations inside `/api/mcp` | every nonregistered route; browser cookie/JWT auth; watchlist mutations |
| Anime List | Anonymous native `/api/mcp` proxy allowlisted to six catalog/detail/stats/random tools | watchlists, tags, account records, credentials, mutations |
| Significant Hobbies | `GET /api/mcp/hobbies`, `/experiences`, `/experiences/:slug`, `/timelines`, `/timelines/:id` | every private feature and any timeline not exactly `PUBLIC` |
| Research Papers | Local `GET /search`, `/papers/:id`, `/similar/:id`, `/hot`, `/sleepers`; public `/paths.json`; fallback `/data/hot.json`, `/data/sleepers.json` | `/rag/query`, PDF delivery, ClickHouse/SQL, ingest, enrichment, jobs, operator routes |
| Setline | `GET /api/mcp/programme`, `/templates`, `/history`, `/history/:id`, `/progress` | `/api/app/state`, execution, programme changes, recommendations/actions, sync, import, account routes |
| SWE Interview Prep | Public `GET /curriculum/catalog.json`, `/system-design/catalog.json`; OAuth `GET /api/mcp/daily`, `/api/mcp/progress`, `/api/mcp/verification` | progress writes, self-attested mastery, stored review answers, chats, account records, code execution |
| SaaS Maker | `GET /api/ai` | private Fleet registry, operations, deployments, credentials, owner data |
| Drank | `GET /api/dr?target=<validated-public-hostname>` | provider credentials, private targets, persistence, arbitrary provider calls |

The shared runtime enforces GET, relative fixed paths, configured origins, a 10-second default timeout, at most one retry, a one-megabyte upstream bound, structured output bounds, credential-key redaction, and per-app credentials that are never accepted as tool input.

TechData's four Food tools emit first-party App Health usage events after successful
reads. The event contains a fixed operation name and route, a timestamp, and random
delivery identifiers. Queries, source records, and caller identity are excluded.
These server events use a TechData-scoped `APP_HEALTH_TECHDATA_INGEST_KEY` and the
matching `APP_HEALTH_TECHDATA_ENVIRONMENT_ID`. Delivery is disabled until both
are configured.
The monitor declares its requests with `X-Fleet-QA: 1`, which omits those calls from
product-event reporting. Clients can opt out with the same header, so counts are
observed successful calls. Delivery runs outside the tool response and reports
rejected or incomplete receipts with fixed diagnostics.
