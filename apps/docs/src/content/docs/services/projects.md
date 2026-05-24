---
title: Projects & README
description: Manage project settings and project README content via the API.
---

Projects are the top-level container in Foundry. Each project has its own API key, settings, and features such as feedback, roadmap, testimonials, changelog, and waitlist.

## Project README

Each project has an optional markdown README accessible via API. Use it to store project documentation, setup instructions, or notes that AI agents can read.

### Get README (API Key)

```bash
curl https://api.sassmaker.com/v1/projects/readme \
  -H "X-Project-Key: pk_your_api_key"
```

### Update README (API Key)

```bash
curl -X PUT https://api.sassmaker.com/v1/projects/readme \
  -H "Content-Type: application/json" \
  -H "X-Project-Key: pk_your_api_key" \
  -d '{ "content": "# My Project\n\nSetup instructions here..." }'
```

### SDK Usage

```typescript
import { SaaSMakerClient } from '@saas-maker/sdk';

const client = new SaaSMakerClient({ apiKey: 'pk_your_api_key' });

// Read
const { readme } = await client.projects.getReadme();

// Write
await client.projects.updateReadme('# My Project\n\nUpdated docs.');
```

## Dashboard Endpoints (Session Auth)

These require a session Bearer token (used by the dashboard UI):

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/projects` | List all projects |
| POST | `/v1/projects` | Create a project |
| GET | `/v1/projects/by-slug/:slug` | Get project by slug |
| PATCH | `/v1/projects/:id` | Update project name or notes |
| DELETE | `/v1/projects/:id` | Delete project |
| GET | `/v1/projects/:id/readme` | Get README |
| PUT | `/v1/projects/:id/readme` | Update README |

## CLI

```bash
fnd projects list
fnd projects create --name "My App"
fnd projects update --id <id> --name "New Name"
fnd projects delete --id <id> --force
```
