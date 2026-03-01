# Testimonials Feature Design

## Overview

Add a testimonials service to saas-maker: embeddable SDK widget for collecting and displaying social proof, moderation dashboard, and API endpoints.

## Package

- Location: `packages/testimonials-widget/`
- Published name: `@saasmaker/testimonials`
- Build: tsup (ESM + CJS + DTS), same pattern as `@saasmaker/feedback`
- Peer deps: `react >= 18`, `react-dom >= 18`
- Workspace dep: `@saasmaker/shared-types`

## Data Model

```sql
CREATE TABLE testimonials (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  author_name TEXT NOT NULL,
  author_email TEXT NOT NULL,
  author_avatar_url TEXT,
  author_title TEXT,
  content TEXT NOT NULL,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  image_url TEXT,
  tweet_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_testimonials_project ON testimonials(project_id);
CREATE INDEX idx_testimonials_project_status ON testimonials(project_id, status);
```

## API Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST /v1/testimonials` | API key | Submit testimonial |
| `GET /v1/testimonials` | API key | List approved (for wall widget) |
| `GET /v1/testimonials/all` | Session | Dashboard list (all statuses) |
| `PATCH /v1/testimonials/:id` | Session | Approve/reject |
| `DELETE /v1/testimonials/:id` | Session | Delete |

- Public GET returns only `status = 'approved'`
- Supports `?limit=` and `?sort=newest|rating`
- Dashboard GET requires `?project_id=` and ownership check

## SDK Components

### `<TestimonialForm />`

Props (add `TestimonialFormProps` to shared-types):

```typescript
export interface TestimonialFormProps {
  projectId: string;
  apiBaseUrl?: string;
  theme?: 'light' | 'dark' | 'auto';
  accentColor?: string;
  placeholder?: string;
  buttonText?: string;
  showImageUpload?: boolean;
  showTweetUrl?: boolean;
}
```

States:
1. Default — name, email, title (optional), star rating, text, image upload, tweet URL
2. Submitting — spinner, inputs disabled
3. Success — "Thank you for your testimonial!"
4. Error — inline error message

### `<TestimonialWall />`

Props (add `TestimonialWallProps` to shared-types):

```typescript
export interface TestimonialWallProps {
  projectId: string;
  apiBaseUrl?: string;
  theme?: 'light' | 'dark' | 'auto';
  accentColor?: string;
  layout?: 'masonry' | 'grid' | 'list';
  maxItems?: number;
}
```

Displays approved testimonials in a responsive layout:
- Each card: avatar, name, title, star rating, text, image (if attached), tweet link (styled quote card with X icon)
- Tweet embeds rendered as styled quote cards (no external Twitter script)

## Styling

- Self-contained CSS, scoped with `smw-tm-` prefix
- CSS variables for theming (`--smw-tm-accent`, etc.)
- Light/dark/auto modes via prefers-color-scheme
- Same approach as feedback widget's CSS

## Dashboard

- Page: `apps/dashboard/src/app/projects/[slug]/testimonials/page.tsx`
- Sidebar nav: "Testimonials" with Star icon
- Stat cards: Total, Pending, Approved, Average Rating
- Table: all testimonials with status badges, approve/reject/delete actions
- Image uploads: reuse existing `/v1/upload` endpoint

## File Structure

```
packages/testimonials-widget/
  package.json
  tsconfig.json
  src/
    index.ts
    TestimonialForm.tsx
    TestimonialWall.tsx
    api.ts
    styles/
      testimonials.css
```
