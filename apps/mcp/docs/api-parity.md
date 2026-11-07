# API and tool parity

Date: 2026-08-29

“Parity” has three different meanings for these plugins:

1. **Published contract parity** — the live MCP advertises exactly the tools
   committed for that plugin, with no missing or additional tools.
2. **Approved upstream parity** — every committed MCP tool maps to its fixed,
   reviewed read source and every approved operation has a tool.
3. **Full product API parity** — every API in the owning application is exposed.

The release requires the first two. It intentionally rejects the third because
the products contain writes, administrative operations, private data, and
other capabilities outside the read-only publication boundary.

## Published contract

| Plugin | Expected tools | Current evidence |
| --- | ---: | --- |
| Reader | 3 | Gateway/product tests pass; authenticated live discovery awaits the OpenAI reviewer flow |
| Calorie | 4 | Gateway/product tests pass; authenticated live discovery awaits the OpenAI reviewer flow |
| My Anime List | 10 | Native production discovery returns the exact ten-tool catalog; authenticated branded discovery awaits the reviewer flow |
| Anime List | 6 | Gateway tests enforce the exact anonymous native allowlist; activation pending |
| Starboard | 4 | Live catalog equality holds, but every tool *call* currently fails: Starboard's edge worker 404s all `GET /api/*`. See "Known outages" in the README |
| High Signal | 2 | Local contract is intentionally reduced to daily signals plus exact signal evidence, and production now serves the same 2 (`get_daily_signals`, `get_signal_evidence`) since the reduction shipped in `ef11d519`. Its live dataset is currently empty; that is tracked separately |
| Significant Hobbies | 5 | Manual production monitor enforces exact live catalog equality |
| Research Papers | 3 | Manual production monitor enforces exact live catalog equality |
| SWE Interview Prep | 8 | Gateway and product tests enforce the five public curriculum tools plus three OAuth, user-scoped learning projections; the understanding check exposes prompts without answers and preserves product-owned mastery |
| SaaS Maker | 4 | Gateway tests enforce exact catalog equality; production activation pending |
| Drank | 1 | Gateway tests enforce exact catalog equality; production activation pending |

The private expected catalogs are:

- Reader: `search_saved_reading`, `get_saved_item`,
  `list_reader_collections`.
- Calorie: `get_daily_nutrition`, `get_nutrition_history`,
  `search_saved_foods`, `list_goal_cycles`.
- My Anime List: `search_anime`, `search_manga`, `get_anime_detail`,
  `get_manga_detail`, `get_anime_stats`, `get_random_anime`, `list_watchlist`,
  `list_manga_watchlist`, `list_watchlist_tags`, `get_watchlist_enriched`.
- SWE Interview Prep: `get_daily_learning_priority`, `get_learning_progress`,
  `get_current_learning_check`,
  plus the five public curriculum and system-design tools.

The public Anime List catalog is exactly `search_anime`, `search_manga`,
`get_anime_detail`, `get_manga_detail`, `get_anime_stats`, and
`get_random_anime`. Watchlist calls are rejected before upstream forwarding.

Private catalog parity is not considered production-proven until the same
exact lists are observed through each branded endpoint using its dedicated
non-owner reviewer account. That check is part of the pre-submission OAuth
evaluation, not something inferred from unauthenticated metadata.

## Deliberate non-parity with full product APIs

The following surfaces remain unavailable by design:

- All create, update, delete, upload, send, sync, ingest, refresh, purchase, and
  other mutation APIs.
- Reader sharing, PDF download, AI chat, and credential surfaces.
- Calorie medication and weight history plus all journal/goal mutations.
- Anime List watchlist mutations and arbitrary API/browser-session access.
- Significant Hobbies journals, Daily, habits, Trajectory, commitments,
  bucket lists, accounts, and non-public timelines.
- Starboard private repositories, saved lists, discussions, jobs, and admin.
- High Signal watchlists, delivery, review, provider, ingest, refresh, and
  administrative state.
- Research Papers full-corpus search, similarity, paid RAG, PDFs, ingest,
  enrichment, databases, and operator controls.
- SWE Interview Prep progress writes, self-attested mastery, notes, stored
  review answers, chats, account records, and code execution. Its three
  personal tools expose only product-computed learning projections.
- SaaS Maker internal registry, operations, deployments, credentials, and
  owner-only data.
- Drank provider credentials, private targets, history, and arbitrary provider
  operations.

Adding any excluded API is a privacy/product-scope change requiring a new
review; it is not a parity bug.


## Account actions and native products

Anchor is the first prepared read/write native connection. Its `/anchor/mcp`
route proxies the product-owned `/anchor/mcp` handler in Personal Platform.
The gateway does not interpret planner records or run an AI model. The previous
connections retain their existing read-only contracts.

A new product supplies a native MCP handler that calls its own application
services. Register a `kind: "native"` route with an exact OAuth resource, a
required read scope, an optional write scope and an explicit `toolScopes` map.
That map limits discovery and execution to the approved tool names. Each tool
advertises its required scopes. A read-only grant can discover write tools but
cannot execute them. Unknown tools and alternate protocol methods fail closed.
The product must independently verify the same token and required permissions.

The identity authority maps a verified provider subject to an existing permanent
account ID. Never accept a user ID from tool arguments, identify people by email,
or replace per-account credentials with an owner-wide shared application token.

Use one source of business rules for UI, REST and MCP. Validate external inputs
once at the product boundary. Return stable IDs and current record versions;
require expected versions for edits and caller-stable request IDs for retries.
A conflict must leave the existing record intact. Do not automatically retry a
write under a new request ID after a lost response.

Device actions need a separate completion contract. Anchor focus commands target
one device, expire, and carry the expected active session ID. Queue acceptance
returns `pending`. Only a receipt from the actual native focus controller can
report `applied`; an expired, interrupted or rejected command reports `failed`.
Opening the capture sheet does not assert that a distraction was saved.

Anchor schedule sharing is opt-in and account-bound. Device-local distraction
notes and keywords are never uploaded or returned by the remote connection.
System permissions, calendar/reminder credentials and native-only configuration
must not appear in tool payloads. Preserve explicit capability limitations.

### Anchor activation gates

The route is prepared and fails closed until the gateway runtime explicitly sets
`MCP_ENABLED_WRITE_PRODUCTS=anchor`. The flag is not configured by this change.
Before advertising an installable
connection, qualify the identity service, backend, gateway and signed Anchor
build together. Configure the existing authorization provider for the exact
Anchor resource and `anchor.read` / `anchor.write` permissions. Bind the branded
host to the existing gateway, without copying product credentials. Issue account permissions only through the authorization provider's approved
consent policy. The initial challenge requests read and write; separately qualify
read-only grants and permission step-up in each supported client. Verify discovery,
PKCE sign-in, an account-scoped read, a permitted edit and native readback. Deny a
read-only write and a different account's record. Replay a lost-response write,
exercise a version conflict and verify a queued focus command reaches an awake
native app exactly once. Keep pending/offline receipts truthful.

For ChatGPT, connect the remote HTTPS MCP endpoint using OAuth. For Codex or
another MCP client, use the same endpoint and complete that client's OAuth flow.
Client installation is separate from server release and source tests.
