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

Use session tokens for dashboard operations and the CLI. These are issued via Google OAuth through Auth.js.

Pass the token in the `Authorization` header:

```bash
curl https://api.sassmaker.com/v1/feedback/123 \
  -X PATCH \
  -H "Authorization: Bearer eyJhbGciOiJS..." \
  -H "Content-Type: application/json" \
  -d '{ "status": "in_progress" }'
```

**Use for:** Dashboard, CLI, admin operations (updating statuses, deleting entries, viewing analytics).

Provider keys saved for AI Gateway are write-only. Config reads return whether a key is configured and a masked preview, never the stored secret.

## When to use which

| Action | Auth method |
|--------|------------|
| Submit feedback from your app | API Key |
| Join a waitlist | API Key |
| Submit a testimonial | API Key |
| Read published changelog | API Key |
| Search knowledge base | API Key |
| AI chat/embeddings/RAG | API Key |
| Track analytics events | API Key |
| Update feedback status | Session Token |
| View analytics dashboard | Session Token |
| Manage testimonials (approve/reject) | Session Token |
| Create changelog entries | Session Token |
| Configure AI provider | Session Token |
| View AI usage/logs | Session Token |
