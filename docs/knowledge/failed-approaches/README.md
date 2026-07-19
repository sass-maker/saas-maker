# Failed Approaches

Removed or shelved directions and the reason they did not ship. Read this
before reopening a closed direction. Each entry names what was removed, why,
and the commit or date so the history is recoverable.

## Entries

- [`2026-06-20-knowledge-rag-in-api.md`](06-20-knowledge-rag-in-api.md) —
  in-API knowledge/RAG service removed; SaaS Maker is not a search/RAG hub.
- [`2026-06-20-ops-block-prototypes.md`](06-20-ops-block-prototypes.md) —
  Magic Form Builder and AI Feedback Digest shelved; no owner or review
  boundary.
- [`2026-06-20-resend-email-package.md`](06-20-resend-email-package.md) —
  `@saas-maker/email` (Resend) removed; Cloudflare Email Workers migration not
  complete, so owner email notifications are parked.

## How to add an entry

1. File name: `<date>-<short-topic>.md`.
2. State what was removed/shelved, the reason, the removing commit (if any),
   and the conditions under which it could be revisited.
3. Add a row to the list above.
4. Do not relitigate the decision here — that belongs in
  [`../../architecture/decisions/`](../../architecture/decisions/README.md) if a new
  decision reverses it.
