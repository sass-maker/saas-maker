---
title: Introduction
description: What SaaS Maker is and how it helps you build SaaS products faster.
---

SaaS Maker is a drop-in backend-as-a-service for SaaS apps. Instead of building common SaaS features from scratch, plug in SaaS Maker and get production-ready services in minutes.

## Services

| Service | What it does |
|---------|-------------|
| **Feedback & Feature Requests** | Collect bugs, feature requests, and general feedback with voting |
| **Waitlist** | Capture pre-launch signups with automatic welcome emails |
| **Testimonials** | Collect, moderate, and display customer testimonials |
| **Changelog** | Publish product updates with categories and drafts |
| **Knowledge Base** | Vector search / RAG-powered document search |
| **Analytics** | Track page views and custom events |

## How it works

1. **Create a project** in the [dashboard](https://saasmaker.vercel.app)
2. **Get your API key** from project Settings
3. **Use the REST API or SDK** to integrate services into your app

```bash
npm install @saas-maker/sdk
```

```typescript
import { SaaSMakerClient } from '@saas-maker/sdk';

const client = new SaaSMakerClient({
  apiKey: 'pk_your_api_key',
  baseUrl: 'https://saasmaker-api.sarthakagrawal927.workers.dev',
});
```

## Architecture

- **API** — Cloudflare Workers (globally distributed, low latency)
- **Database** — CockroachDB (distributed SQL)
- **Widgets** — Embeddable React components for feedback, testimonials, and changelog
- **Dashboard** — Next.js app for managing projects and services
