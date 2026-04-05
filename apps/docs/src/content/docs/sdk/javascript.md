---
title: JavaScript SDK
description: Use the SaaS Maker JavaScript SDK to integrate services into your app.
---

The JavaScript SDK provides a typed client for all SaaS Maker API endpoints.

## Installation

```bash
npm install @saas-maker/sdk
```

## Setup

```typescript
import { SaaSMakerClient } from '@saas-maker/sdk';

const client = new SaaSMakerClient({
  apiKey: 'pk_your_api_key',
  baseUrl: 'https://api.sassmaker.com',
});
```

For dashboard-only SDK surfaces such as `aiMention`, also pass a `sessionToken`:

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
  content: 'SaaS Maker saved us weeks.',
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

## Knowledge Base

```typescript
// Create an index
const index = await client.indexes.create({
  name: 'help-docs',
  embedding_model: '@cf/baai/bge-base-en-v1.5',
});

// Upload a document
await client.indexes.ingest(index.id, {
  content: 'Your document text here...',
  metadata: { source: 'docs' },
});

// Search
const { results } = await client.indexes.search(index.id, {
  query: 'how do I get started?',
  top_k: 5,
});
```

## Analytics

```typescript
// Track an event
await client.analytics.track({
  name: 'page_view',
  url: 'https://myapp.com/pricing',
});
```

## Forms

```typescript
// Get a public form by slug
const form = await client.forms.getPublic('my-form-slug');

// Submit a form response
await client.forms.submitPublic('my-form-slug', {
  answers: { field_1: 'value', field_2: 42 },
});

// List forms (API key auth)
const forms = await client.forms.getBySlug('my-form-slug');
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

## AI Gateway

```typescript
// Chat completion
const response = await client.ai.chat({
  messages: [{ role: 'user', content: 'What is SaaS Maker?' }],
});

// Embeddings
const embeddings = await client.ai.embed('What is SaaS Maker?');

// RAG (retrieval-augmented generation)
const answer = await client.ai.rag({
  query: 'How do I collect feedback?',
  index_id: 'idx_123',
  top_k: 5,
});

// Streaming (chat)
const stream = await client.ai.chatStream({
  messages: [{ role: 'user', content: 'Explain SaaS Maker' }],
});
const reader = stream.body!.getReader();
// Read SSE chunks from the reader

// Streaming (RAG)
const ragStream = await client.ai.ragStream({
  query: 'How do I collect feedback?',
  index_id: 'idx_123',
});
```

## AI Mention Check

```typescript
const dashboardClient = new SaaSMakerClient({
  sessionToken: 'sm_your_session_token',
  baseUrl: 'https://api.sassmaker.com',
});

await dashboardClient.aiMention.saveConfig('proj_123', {
  brand_name: 'Acme',
  platforms: ['openai'],
  openai_api_key: 'sk-...',
});

await dashboardClient.aiMention.addPrompt('proj_123', {
  prompt_text: 'What is the best AI customer support tool?',
  category: 'support',
});

const check = await dashboardClient.aiMention.runCheck('proj_123');
const details = await dashboardClient.aiMention.getCheck('proj_123', check.id);
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
