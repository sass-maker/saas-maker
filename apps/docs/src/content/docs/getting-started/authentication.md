---
title: Authentication
description: How to authenticate with the Foundry API using API keys or session tokens.
---

Foundry uses two authentication methods depending on the context.

## API Key

Use API keys for SDK calls, widget integrations, and public-facing endpoints.

Pass your project API key in the `X-Project-Key` header:

```bash
curl https://api.sassmaker.com/v1/feedback \
  -H "X-Project-Key: pk_abc123"
```

API keys start with `pk_` and are scoped to a single project. Get yours from **Project Settings** in the dashboard.

**Use for:** SDK, widgets, public endpoints (submitting feedback, joining waitlist, viewing testimonials).

## Session Token

Use session tokens for dashboard operations and the CLI. The Cockpit issues opaque Bearer tokens through better-auth (Google OAuth); the Workers API validates them against the shared D1 `session` table.

Pass the token in the `Authorization` header:

```bash
curl -X PATCH https://api.sassmaker.com/v1/feedback/abc-123 \
  -H "Authorization: Bearer <session-token>" \
  -H "Content-Type: application/json" \
  -d '{ "status": "dismissed" }'
```

**Use for:** Dashboard, CLI, and admin operations like updating statuses or deleting entries.

### CLI tokens

`fnd login` stores its token in `~/.foundry/config.json` under `apiKey` (prefixed `sm_...`). The API accepts both shapes — the regular session cookie and the `sm_`-prefixed CLI token — through the same `Authorization: Bearer` header.

## Provider key storage

Provider keys saved for the AI Gateway are write-only. Config reads return whether a key is configured and a masked preview, never the stored secret. Set the Worker secret `AI_GATEWAY_KEY_SECRET` to encrypt newly stored provider keys at rest; existing plaintext keys continue to work until they are rotated.

## When to use which

| Action | Auth method |
|--------|------------|
| Submit feedback from your app | API Key |
| Join a waitlist | API Key |
| Submit a testimonial | API Key |
| Read published changelog | API Key |
| AI chat/embeddings | API Key |
| Update feedback status | Session Token |
| Manage testimonials (approve/reject) | Session Token |
| Create changelog entries | Session Token |
| Configure AI provider | Session Token |
| View AI usage/logs | Session Token |
