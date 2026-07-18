---
title: "Testimonial Widgets"
description: "Display approved testimonials and collect new ones with embeddable React components."
---

Two React components for testimonials: a display wall for your marketing pages and a submission form for collecting new testimonials.

## Installation

```bash
npm install @saas-maker/testimonials
```

## TestimonialWall

Displays approved testimonials in a grid, masonry, or list layout. Automatically fetches from the API.

```tsx
import { TestimonialWall } from '@saas-maker/testimonials';

function LandingPage() {
  return (
    <TestimonialWall
      projectId="pk_your_api_key"
      apiBaseUrl="https://api.sassmaker.com"
    />
  );
}
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `projectId` | `string` | -- | Your project API key (required) |
| `apiBaseUrl` | `string` | -- | API base URL (required) |
| `theme` | `'light' \| 'dark' \| 'auto'` | `'auto'` | Color theme |
| `accentColor` | `string` | `'#1464ff'` | Brand accent color |
| `layout` | `'masonry' \| 'grid' \| 'list'` | `'grid'` | Card layout style |
| `maxItems` | `number` | -- | Limit the number of testimonials shown |

Each card shows the author name, title, star rating, testimonial text, optional image, and a link to the original tweet if provided.

## TestimonialForm

Embeddable form for collecting new testimonials. Submissions go through the approval flow (pending until you approve in the dashboard).

```tsx
import { TestimonialForm } from '@saas-maker/testimonials';

function CollectPage() {
  return (
    <TestimonialForm
      projectId="pk_your_api_key"
      apiBaseUrl="https://api.sassmaker.com"
    />
  );
}
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `projectId` | `string` | -- | Your project API key (required) |
| `apiBaseUrl` | `string` | -- | API base URL (required) |
| `theme` | `'light' \| 'dark' \| 'auto'` | `'auto'` | Color theme |
| `accentColor` | `string` | `'#1464ff'` | Brand accent color |
| `placeholder` | `string` | `'Share your experience...'` | Textarea placeholder |
| `buttonText` | `string` | `'Submit Testimonial'` | Submit button label |
| `showImageUpload` | `boolean` | `true` | Show the image attachment option |
| `showTweetUrl` | `boolean` | `false` | Show the tweet URL field |

The form collects name, email, title/company, star rating, testimonial text, and optionally an image or tweet URL. After submission, a success message is shown.

## Public submission page

You can also share the built-in submission page with your users:

```
https://app.sassmaker.com/t/[project-slug]
```

This is useful for email campaigns and onboarding flows where embedding a React component is not practical.
