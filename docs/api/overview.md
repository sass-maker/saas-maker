---
title: Feedback API
description: The intentionally small SaaS Maker HTTP API.
---

Base URL: https://api.sassmaker.com

| Surface | Purpose | Auth |
| --- | --- | --- |
| GET /health | Liveness | None |
| POST /v1/feedback | Submit feedback | X-Project-Key |
| GET /v1/feedback | List one project's feedback | X-Project-Key |
| GET /v1/feedback/by-project/:slug | Public feedback board | Optional session |
| POST /v1/upload | Upload a feedback image | X-Project-Key |
| /v1/projects | Manage project keys | Owner session |
| /v1/auth/session | Resolve inbox session | Owner session |

All other historical SaaS Maker service families are retired from this API.
