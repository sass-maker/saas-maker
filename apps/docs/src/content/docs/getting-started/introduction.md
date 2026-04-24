---
title: Introduction
description: What Foundry is and how it helps you standardize and accelerate your development.
---

Foundry is a comprehensive toolkit designed for developers who manage multiple JavaScript/TypeScript projects. It provides a "Gold Standard" for configurations, a modular library of "Blocks," and a "Commander" CLI to eliminate configuration drift and accelerate development across your entire project fleet.

## The Four Pillars

| Pillar | Purpose | Key Components |
|--------|---------|----------------|
| **1. The Standard** | Fleet-wide Consistency | ESLint, TSConfig, Prettier, Dev-Config |
| **2. The Blocks** | Modular Capabilities | AI, DB, SDK, Analytics, Widgets |
| **3. The Commander** | Fleet Management | Fleet Audit, Global Linting, Mass Upgrades |
| **4. The Forge** | Rapid Scaffolding | Template-based project initialization |

## Core Services

Foundry provides high-quality, pre-built modules that you can drop into any project:

- **The Standard**: Versioned configs for Next.js, Vite, and Node.
- **The Blocks**: Unified AI providers, PostHog wrappers, and DB utilities.
- **The Widgets**: Embeddable React components for Feedback, Changelogs, and Testimonials.
- **The Engine**: A high-performance Cloudflare Worker backend powering all blocks.

## Architecture

- **The Standard** — Versioned packages in `packages/tooling` used by all your repos.
- **The Blocks** — Modular logic and UI packages in `packages/blocks` and `packages/widgets`.
- **The Cockpit** — A Next.js dashboard to monitor your fleet's health and analytics.
- **The CLI** — The unified interface for managing projects and standards.

## Next Steps

1. **[Quickstart](/getting-started/quickstart)** — Get the Foundry running in 5 minutes.
2. **[The Standard](/getting-started/standard)** — Learn about our linting and TS rules.
3. **[The CLI](/sdk/cli)** — Explore the Commander and Forge tools.
