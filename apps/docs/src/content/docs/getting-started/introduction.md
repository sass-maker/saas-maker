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

1. **Install the CLI** and log in
2. **Create a project** and link it to your app directory
3. **Use the REST API, SDK, or widgets** to integrate services

```bash
npm install -g @saas-maker/cli
saasmaker login
saasmaker projects create
saasmaker init
```

Or manage projects from the [dashboard](https://app.sassmaker.com) if you prefer a UI.

## Architecture

- **CLI** — Create and manage projects from your terminal
- **API** — Cloudflare Workers (globally distributed, low latency)
- **Database** — CockroachDB (distributed SQL)
- **Widgets** — Embeddable React components for feedback, testimonials, and changelog
- **Dashboard** — Next.js app for managing projects and services
