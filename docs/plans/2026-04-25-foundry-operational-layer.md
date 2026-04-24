# Foundry Operational Layer Strategy

**Date:** April 25, 2026
**Goal:** Transition the Foundry from "Shared Configurations" (Tooling) to "Shared Machinery" (Operational Middleware) across the 22-project fleet.

---

## 🛑 The Problem
While `@saas-maker/tooling` solved configuration drift (ESLint, TS, Prettier), the **fleet still suffers from operational drift**:
1. **Databases:** Connecting to Cloudflare D1 vs Turso requires different boilerplate and drivers in every project.
2. **Error Handling:** Every project logs errors differently, making fleet-wide monitoring impossible.
3. **Protection:** Rate limiting is either forgotten (risk) or implemented inconsistently (Redis vs CF KV).

## 🏗️ The Solution: The "Ops" Blocks

We will build three foundational "Headless Capabilities" (Blocks) that provide standardized operational middleware.

### 1. `@foundry/ops` (The Nervous System)
*   **Unified Error Engine**: A standardized `FoundryError` class that captures context, stack traces, and project IDs.
*   **Telemetry (Pulse)**: A `trace` wrapper for async logic that automatically ships timing and success/fail data to the Cockpit/PostHog.

### 2. `@foundry/db` (The Data Engine)
*   **Environment-Aware Factory**: Automatically detects CF Workers (`env.DB`) vs Node (`DATABASE_URL`) and initializes D1 or LibSQL.
*   **Golden Columns**: Standardized Drizzle snippets for `id` (cuid), `createdAt`, `updatedAt`, and `deletedAt`.
*   **Integrated Tracing**: Wraps all queries in `@foundry/ops` traces automatically.

### 3. `@foundry/rate-limit` (The Shield)
*   **Multi-Store Drivers**: Supports Cloudflare KV and Upstash Redis.
*   **Sliding Window**: Professional-grade rate limiting to prevent edge-of-minute spikes.
*   **Dev-Mode Bypass**: Fails open (warns instead of blocks) during local development.

---

## 🚀 Execution Roadmap

1. **Phase 1 (Ops Core)**: Build the Error and Trace classes.
2. **Phase 2 (Data & Shield)**: Build the DB Factory and Rate Limiter, linking them to Ops.
3. **Phase 3 (The Forge)**: Update `fnd forge` to automatically scaffold `src/lib/foundry.ts` with these blocks pre-configured.
4. **Phase 4 (The Cockpit)**: Upgrade the dashboard to display the unified error feed and DB trace metrics from the fleet.