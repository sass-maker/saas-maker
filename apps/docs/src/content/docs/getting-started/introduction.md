---
title: Introduction
description: What Foundry is and how it keeps a product fleet operable.
---

Foundry is the operating layer for a growing fleet of SaaS products. It gives every app the same source of truth for project metadata, tasks, comments, deployment state, product widgets, audit results, and agent handoffs.

It is API-first on purpose: the cockpit is useful for humans, but the REST API, TypeScript SDK, and `fnd api` CLI are what make it easy for agents and scripts to keep the fleet current.

## The Operating Loop

| Layer | Purpose | Key Components |
|-------|---------|----------------|
| **Registry** | Know what exists | Project slugs, prod links, GitHub repos, notes, limits |
| **Tasks** | Know what needs work | Comments, blockers, PR status, deploy state, agent handoffs |
| **Widgets** | Add product surfaces fast | Feedback, changelog, testimonials, waitlist, analytics, badge |
| **Audits** | Keep the fleet healthy | GitHub, Cloudflare, auth, smoke, performance checks |
| **Standards** | Reduce drift | Shared configs, docs, CLI recipes, fleet guidance |

## Core Services

Foundry provides high-quality modules you can drop into any product:

- **Project metadata**: production URLs, GitHub links, README summaries, rate limits, and operating notes.
- **Symphony tasks**: durable task records with comments, blockers, branch/PR/deploy fields, and audit history.
- **Widgets**: embeddable React components for feedback, changelogs, testimonials, waitlists, analytics, progress, and badges.
- **Fleet audits**: repeatable checks across GitHub, Cloudflare, production smoke, auth, and performance.
- **Free AI first**: gateway patterns that prefer free/local AI before paid providers.

## Architecture

- **Workers API** — Hono on Cloudflare Workers, backed by D1.
- **Cockpit** — Next.js dashboard for projects, tasks, analytics, and fleet state.
- **Docs** — copy-paste recipes for API, CLI, SDK, and widgets.
- **CLI** — the unified interface for agents and scripts.

## Next Steps

1. **[Quickstart](/getting-started/quickstart)** — Create a project and call the API.
2. **[CLI](/sdk/cli)** — Manage projects, tasks, and fleet metadata from scripts.
3. **[Widgets](/widgets/feedback)** — Add a product surface without building a backend.
