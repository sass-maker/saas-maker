---
title: Forms & Surveys
description: Create custom forms and surveys to collect structured responses from your users.
---

Build multi-question forms and surveys with 15 question types, collect responses via API or hosted page, and view per-question analytics in the dashboard.

## Question types

| Type | Description |
|------|-------------|
| `short_text` | Single-line text input |
| `long_text` | Multi-line textarea |
| `multiple_choice` | Radio buttons — pick one option |
| `checkboxes` | Check multiple options |
| `dropdown` | Select from a dropdown list |
| `yes_no` | Boolean yes/no toggle |
| `rating` | Star rating (e.g. 1–5) |
| `nps` | Net Promoter Score (0–10) |
| `opinion_scale` | Numeric scale (e.g. 1–10) |
| `email` | Email address input |
| `number` | Numeric input |
| `date` | Date picker |
| `phone` | Phone number input |
| `url` | URL input |
| `file_upload` | File attachment |

## Public submission page

Every published form gets a hosted survey page at:

```
https://app.sassmaker.com/s/[form-slug]
```

Share this link in emails, onboarding flows, or embed it in an iframe. No API key required.

## API endpoints

### Get published form by slug (API key)

```
GET /v1/forms/by-slug/:slug
```

**Auth:** API Key

```bash
curl https://api.sassmaker.com/v1/forms/by-slug/customer-survey \
  -H "X-Project-Key: pk_abc123"
```

**Response fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Form ID |
| `title` | string | Form title |
| `slug` | string | URL-friendly slug |
| `description` | string | Form description |
| `status` | string | Always `published` for this endpoint |
| `questions` | array | Ordered list of questions |

Each question object:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Question ID |
| `type` | string | One of the 15 question types |
| `label` | string | Question text |
| `description` | string | Optional helper text |
| `required` | boolean | Whether an answer is required |
| `options` | object | Type-specific config (e.g. choices for multiple_choice) |
| `order_index` | number | Display order |

### Submit response (API key)

```
POST /v1/forms/:formId/submit
```

**Auth:** API Key

```bash
curl -X POST https://api.sassmaker.com/v1/forms/abc-form-id/submit \
  -H "Content-Type: application/json" \
  -H "X-Project-Key: pk_abc123" \
  -d '{
    "answers": [
      { "question_id": "q1", "value": "Very satisfied" },
      { "question_id": "q2", "value": "9" }
    ]
  }'
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `answers` | array | Yes | Array of answer objects |
| `answers[].question_id` | string | Yes | ID of the question being answered |
| `answers[].value` | string | Yes | The answer value |

Returns `201` with the created response and answers.

### Get published form by slug (public, no auth)

```
GET /v1/forms/public/:slug
```

**Auth:** None

```bash
curl https://api.sassmaker.com/v1/forms/public/customer-survey
```

Same response shape as the API key variant. Used by the hosted survey page.

### Submit response by slug (public, no auth)

```
POST /v1/forms/public/:slug/submit
```

**Auth:** None

```bash
curl -X POST https://api.sassmaker.com/v1/forms/public/customer-survey/submit \
  -H "Content-Type: application/json" \
  -d '{
    "answers": [
      { "question_id": "q1", "value": "Very satisfied" },
      { "question_id": "q2", "value": "9" }
    ]
  }'
```

Same body as the API key submit endpoint. Used by the hosted survey page.

### Create form (dashboard)

```
POST /v1/forms/dashboard/:projectId
```

**Auth:** Session Token

```bash
curl -X POST https://api.sassmaker.com/v1/forms/dashboard/proj_123 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Customer Survey",
    "slug": "customer-survey",
    "description": "Help us improve our product",
    "status": "draft",
    "questions": [
      {
        "type": "rating",
        "label": "How satisfied are you?",
        "required": true,
        "options": {}
      },
      {
        "type": "long_text",
        "label": "Any additional feedback?",
        "required": false,
        "options": {}
      }
    ]
  }'
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Form title |
| `slug` | string | Yes | URL-friendly slug (unique per project) |
| `description` | string | No | Form description |
| `status` | string | No | `draft`, `published`, or `closed` (default: `draft`) |
| `theme` | object | No | Theme configuration |
| `settings` | object | No | Form settings |
| `questions` | array | No | Inline question creation (see question fields below) |

Question fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | One of the 15 question types |
| `label` | string | Yes | Question text |
| `description` | string | No | Helper text |
| `required` | boolean | No | Default `false` |
| `options` | object | No | Type-specific config (e.g. `{ "choices": ["A", "B"] }`) |
| `order_index` | number | No | Display order (defaults to array index) |

Returns `201` with the created form and questions.

### List forms (dashboard)

```
GET /v1/forms/dashboard/:projectId?page=1
```

**Auth:** Session Token

```bash
curl https://api.sassmaker.com/v1/forms/dashboard/proj_123 \
  -H "Authorization: Bearer <token>"
```

| Field | Type | Description |
|-------|------|-------------|
| `data` | array | List of forms |
| `total` | number | Total form count |
| `page` | number | Current page |
| `limit` | number | Page size (50) |
| `stats` | object | Aggregate form stats |

### Get form (dashboard)

```
GET /v1/forms/dashboard/:projectId/:formId
```

**Auth:** Session Token

```bash
curl https://api.sassmaker.com/v1/forms/dashboard/proj_123/form_456 \
  -H "Authorization: Bearer <token>"
```

Returns the form with questions and `response_count`.

### Update form (dashboard)

```
PATCH /v1/forms/dashboard/:projectId/:formId
```

**Auth:** Session Token

```bash
curl -X PATCH https://api.sassmaker.com/v1/forms/dashboard/proj_123/form_456 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Survey",
    "status": "published"
  }'
```

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | New title |
| `slug` | string | New slug (must be unique in project) |
| `description` | string | New description |
| `status` | string | `draft`, `published`, or `closed` |
| `theme` | object | Theme configuration |
| `settings` | object | Form settings |

### Delete form (dashboard)

```
DELETE /v1/forms/dashboard/:projectId/:formId
```

**Auth:** Session Token

```bash
curl -X DELETE https://api.sassmaker.com/v1/forms/dashboard/proj_123/form_456 \
  -H "Authorization: Bearer <token>"
```

Returns `{ "ok": true }`.

### Bulk upsert questions (dashboard)

```
POST /v1/forms/dashboard/:projectId/:formId/questions
```

**Auth:** Session Token

```bash
curl -X POST https://api.sassmaker.com/v1/forms/dashboard/proj_123/form_456/questions \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "questions": [
      {
        "type": "nps",
        "label": "How likely are you to recommend us?",
        "required": true,
        "options": {},
        "order_index": 0
      },
      {
        "type": "long_text",
        "label": "What could we improve?",
        "required": false,
        "options": {},
        "order_index": 1
      }
    ]
  }'
```

Send the full list of questions. Existing questions with matching IDs are updated; new ones are created. Pass `id` on a question to update it; omit `id` to create a new one.

### List responses (dashboard)

```
GET /v1/forms/dashboard/:projectId/:formId/responses?page=1
```

**Auth:** Session Token

```bash
curl https://api.sassmaker.com/v1/forms/dashboard/proj_123/form_456/responses \
  -H "Authorization: Bearer <token>"
```

| Field | Type | Description |
|-------|------|-------------|
| `data` | array | List of responses with answers |
| `total` | number | Total response count |
| `page` | number | Current page |
| `limit` | number | Page size (50) |

### Analytics (dashboard)

```
GET /v1/forms/dashboard/:projectId/:formId/analytics
```

**Auth:** Session Token

```bash
curl https://api.sassmaker.com/v1/forms/dashboard/proj_123/form_456/analytics \
  -H "Authorization: Bearer <token>"
```

Returns per-question analytics:

| Field | Type | Description |
|-------|------|-------------|
| `form_id` | string | Form ID |
| `total_responses` | number | Total response count |
| `questions` | array | Per-question analytics |

Each question analytics object:

| Field | Type | Description |
|-------|------|-------------|
| `question_id` | string | Question ID |
| `label` | string | Question text |
| `type` | string | Question type |
| `total_answers` | number | Number of non-empty answers |
| `summary` | object | Type-dependent summary (see below) |

Summary varies by question type:

- **Choice types** (`multiple_choice`, `checkboxes`, `dropdown`, `yes_no`): `{ distribution: { "Option A": 5, "Option B": 3 } }`
- **Numeric types** (`rating`, `nps`, `opinion_scale`, `number`): `{ average: 8.5, distribution: { "9": 3, "8": 2 } }`
- **Text types** (`short_text`, `long_text`, `email`, etc.): `{ latest_answers: ["answer1", "answer2", ...] }` (up to 10)

## SDK usage

```javascript
const client = new SaaSMakerClient({ apiKey: 'pk_...' });

// List forms
const forms = await client.forms.list();

// Get form by slug
const form = await client.forms.getBySlug('my-survey');

// Submit response
await client.forms.submit(formId, {
  answers: [
    { question_id: 'q1', value: 'Very satisfied' },
    { question_id: 'q2', value: '9' },
  ]
});
```
