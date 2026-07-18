# In-API Knowledge / RAG — removed 2026-06-20

## What was removed

- API routes `/v1/knowledge/*` and the in-API vector search / RAG service
  bindings.
- Cockpit knowledge UI and the SDK `KnowledgeService`.
- D1 knowledge tables (migration `0021_drop_knowledge.sql`, applied to remote
  `saasmaker-db` on 2026-06-20).

## Why

SaaS Maker is the fleet control plane (tasks, marketing, registry, events,
cockpit). Running a knowledge/RAG hub inside it mixed concerns, added
vector-store operational cost, and duplicated work that belongs in a dedicated
search product. `knowledge-base` is the fleet's private agent-search product;
SaaS Maker is not a search/RAG hub.

## Revisit conditions

Only if a future decision establishes that in-control-plane retrieval is
required for fleet operations (not product search). The dedicated
`knowledge-base` project remains the canonical home for agent search over
project-scoped corpora.

## Related

- Decision context: [`../../architecture/decisions/`](../../architecture/decisions/README.md)
  design records around 2026-06-20.
- Timeline entry: `PROJECT_STATUS.md` → 2026-06-20 — Knowledge/RAG removal.
