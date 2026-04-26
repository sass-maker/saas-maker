---
title: JavaScript SDK
description: Use the Foundry JavaScript SDK to integrate services into your app.
---

The JavaScript SDK provides a typed client for all Foundry API endpoints.

## Installation

```bash
npm install @foundry/sdk
```

## Setup

```typescript
import { SaaSMakerClient } from '@foundry/sdk';

const client = new SaaSMakerClient({
  apiKey: 'pk_your_api_key',
  baseUrl: 'https://api.sassmaker.com',
});
```

For dashboard surfaces (admin operations), pass a `sessionToken` instead:

```typescript
const dashboardClient = new SaaSMakerClient({
  sessionToken: 'sm_your_session_token',
  baseUrl: 'https://api.sassmaker.com',
});
```

## Feedback

```typescript
// Submit feedback
await client.feedback.submit({
  title: 'Add dark mode',
  description: 'Would love a dark mode option',
  type: 'feature',
  submitter_email: 'user@example.com',
});

// List feedback
const { data, total } = await client.feedback.list({
  type: 'feature',
  sort: 'upvotes',
  page: 1,
});
```

## Waitlist

```typescript
// Add to waitlist
const entry = await client.waitlist.join({
  email: 'user@example.com',
  name: 'Jane Doe',
});

// Get total count
const { count } = await client.waitlist.getCount();
```

## Testimonials

```typescript
// Submit a testimonial
await client.testimonials.submit({
  author_name: 'Jane Doe',
  author_email: 'jane@example.com',
  content: 'Foundry saved us weeks.',
  rating: 5,
  author_title: 'CTO at Acme',
});

// List approved testimonials
const testimonials = await client.testimonials.list();
```

## Changelog

```typescript
// List published entries
const entries = await client.changelog.list();
```

## Analytics

```typescript
// Track an event
await client.analytics.track({
  name: 'page_view',
  url: 'https://myapp.com/pricing',
});
```

## Roadmap

```typescript
// List public roadmap items
const items = await client.roadmap.listPublic('my-project-slug');

// Vote on a roadmap item
await client.roadmap.vote('my-project-slug', 'item_123', {
  user_identifier: 'user@example.com',
});

// Remove a vote
await client.roadmap.removeVote('my-project-slug', 'item_123', 'user@example.com');
```

## Projects

```typescript
// Get project README (API key auth)
const { readme } = await client.projects.getReadme();

// Update project README
await client.projects.updateReadme('# My Project\n\nWelcome!');
```

## Error handling

All methods throw on non-2xx responses. Errors include the `message` field from the API:

```typescript
try {
  await client.feedback.submit({ ... });
} catch (err) {
  console.error(err.message); // "Title is required"
}
```
