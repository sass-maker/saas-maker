# Foundry ⚒️

**The Open Source Foundry for Project Fleets.**

Foundry is a comprehensive toolkit designed for developers who manage multiple JavaScript/TypeScript projects. It provides a "Gold Standard" for configurations, a modular library of "Blocks," and a "Commander" CLI to eliminate configuration drift and accelerate development.

---

## 🏛️ The Four Pillars

### 1. The Standard (Tooling)
Standardize your entire fleet with versioned, shared configurations.
*   **`@saas-maker/eslint-config`**: Unified rules for Next.js, Vite, and Node.
*   **`@saas-maker/tsconfig`**: Strict, optimized TypeScript bases.
*   **`@saas-maker/prettier-config`**: Consistent formatting for the whole team.
*   **`@saas-maker/dev-config`**: Automated Husky hooks for linting and safety.

### 2. The Blocks (Common Logic)
High-quality, modular packages that any project can opt into.
*   **`@saas-maker/ai`**: Unified LLM provider integration.
*   **`@saas-maker/analytics-sdk`**: Lightweight PostHog wrapper.
*   **`@saas-maker/db`**: Database utilities for Cloudflare D1/Turso.
*   **`@saas-maker/sdk`**: The core API client for Foundry services.

### 3. The Widgets (UI Components)
Ready-to-drop UI components for common product needs.
*   **Feedback & Roadmap**: Let users vote on features.
*   **Changelog**: Keep your users informed.
*   **Testimonials & Waitlist**: Capture and show user love.

### 4. The Commander & Forge (CLI)
Automate your workflow.
*   **Commander**: Run fleet-wide audits, linting, and upgrades.
*   **Forge**: Scaffold new Foundry-compliant projects in seconds.

---

## 🚀 Quick Start

1. **Install the CLI**:
   ```bash
   pnpm add -g @saas-maker/cli
   ```

2. **Initialize a Project**:
   ```bash
   foundry init
   ```

3. **Open the Cockpit**:
   Launch the local dashboard to monitor your fleet.
   ```bash
   pnpm cockpit dev
   ```

---

## 📂 Repository Structure

*   `packages/tooling/`: Standardized configurations.
*   `packages/blocks/`: Modular logic packages.
*   `packages/widgets/`: UI component blocks.
*   `apps/cockpit/`: The Fleet Management Dashboard.
*   `apps/showcase/`: The Foundry Manual and public showcase.
*   `apps/docs/`: Detailed technical reference.

---

## ⚖️ License

Open source under the MIT License.
