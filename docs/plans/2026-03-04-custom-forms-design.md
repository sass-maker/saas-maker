# Custom Forms / Survey Builder — Design

**Date:** 2026-03-04
**Status:** Approved

## Overview

Add a Typeform-style custom form/survey builder to SaaS Maker. Users create multi-question surveys in a drag-and-drop builder, share via hosted page or embeddable widget, and view responses with basic analytics.

This is a standalone feature alongside existing feedback, waitlist, and testimonial widgets — no deprecation of existing features.

## Question Types (Typeform-inspired)

- **short_text** — Single-line text input
- **long_text** — Multi-line textarea
- **multiple_choice** — Single-select radio buttons
- **checkboxes** — Multi-select checkboxes
- **dropdown** — Select dropdown
- **yes_no** — Binary yes/no toggle
- **rating** — 1-5 star rating
- **nps** — 0-10 Net Promoter Score scale
- **opinion_scale** — Configurable numeric scale (e.g., 1-10 with custom labels)
- **email** — Email input with validation
- **number** — Numeric input
- **date** — Date picker
- **phone** — Phone number input
- **url** — URL input with validation
- **file_upload** — File attachment

## Data Model

```sql
CREATE TABLE forms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id),
  title       TEXT NOT NULL,
  slug        TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'draft',   -- draft | published | closed
  theme       JSONB DEFAULT '{}',              -- accent_color, background, font
  settings    JSONB DEFAULT '{}',              -- show_progress_bar, allow_multiple, thank_you_message
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, slug)
);

CREATE TABLE form_questions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id     UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  label       TEXT NOT NULL,
  description TEXT,
  required    BOOLEAN NOT NULL DEFAULT false,
  options     JSONB DEFAULT '{}',
  order_index INT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE form_responses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id      UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata     JSONB DEFAULT '{}'
);

CREATE TABLE form_answers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID NOT NULL REFERENCES form_responses(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES form_questions(id) ON DELETE CASCADE,
  value       TEXT
);
```

## API Routes

### Dashboard (session auth via Bearer token)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/forms` | Create form |
| GET | `/v1/forms` | List forms for project |
| GET | `/v1/forms/:formId` | Get form + questions |
| PUT | `/v1/forms/:formId` | Update form metadata/status |
| DELETE | `/v1/forms/:formId` | Delete form + cascading data |
| POST | `/v1/forms/:formId/questions` | Bulk upsert/reorder questions |
| PUT | `/v1/forms/:formId/questions/:questionId` | Update question |
| DELETE | `/v1/forms/:formId/questions/:questionId` | Delete question |
| GET | `/v1/forms/:formId/responses` | List responses (paginated) |
| GET | `/v1/forms/:formId/analytics` | Per-question summary analytics |
| DELETE | `/v1/forms/:formId/responses/:responseId` | Delete response |

### Public (API key auth via X-Project-Key)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/forms/by-slug/:slug` | Get published form + questions |
| POST | `/v1/forms/:formId/submit` | Submit response with answers |

### Public page (no auth, dashboard app)

| Route | Description |
|-------|-------------|
| `/s/[slug]` | Hosted Typeform-style survey page |

## Dashboard UI

### Forms List (`/projects/[slug]/forms`)
- Grid of form cards: title, status badge, response count, date
- "Create Form" button

### Form Builder (`/projects/[slug]/forms/[formId]`)
- **Left panel:** Sortable question list (drag-to-reorder) + "Add Question" button with type picker
- **Center:** Inline question editor (type, label, description, required, options)
- **Right panel:** Live Typeform-style preview
- **Top bar:** Editable title, status toggle, share link, settings

### Responses (`/projects/[slug]/forms/[formId]/responses`)
- **Responses tab:** Table with one row per submission, columns per question
- **Analytics tab:** Per-question cards:
  - Choice questions: Bar chart of answer distribution
  - Rating/NPS: Average score + distribution histogram
  - Text questions: List of responses

## Hosted Survey Page (`/s/[slug]`)
- Full-screen, one-question-at-a-time experience
- Progress bar, Enter key to advance, smooth transitions
- Welcome screen with form title/description
- Thank-you screen on completion
- Responsive (works on mobile)

## Survey Widget Package

New package: `packages/survey-widget/` → `@saas-maker/survey`

```tsx
<SurveyWidget
  projectId="pk_..."
  formSlug="my-survey"
  theme="light"           // light | dark | auto
  accentColor="#6366f1"
  onComplete={(response) => {}}
/>
```

Same rendering engine as the hosted page, embeddable in any React app.

## SDK Addition

Add `forms` service to `SaaSMakerClient`:

```ts
client.forms.list()
client.forms.get(formId)
client.forms.getBySlug(slug)
client.forms.create({ title, slug, questions })
client.forms.submit(formId, { answers })
client.forms.responses(formId, { page, limit })
client.forms.analytics(formId)
```

## Documentation

Add docs pages to `apps/docs/`:
- Forms overview + concepts
- API reference for all form endpoints
- Widget installation + usage guide
- SDK forms service reference

## AI-Friendly API

The forms API and docs must be clear enough for AI agents to programmatically create forms. This means:
- Clear, well-documented REST endpoints with examples in docs
- SDK with intuitive method names (`client.forms.create()`)
- llms.txt auto-generated from docs will include forms API reference
- No complex multi-step flows required — a single API call can create a form with all questions

## Decisions

- **No conditional logic in v1** — Linear question flow only
- **Fully normalized schema** — Separate tables for forms, questions, responses, answers
- **Separate from feedback/waitlist** — Forms is a standalone feature
- **Typeform-style UX** — One question at a time with smooth transitions
- **AI-friendly API** — Docs and API designed so AI agents can create forms by reading docs
