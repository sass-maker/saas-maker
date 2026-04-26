# Foundry ⚒️

**The Industrial Software Factory for Project Fleets.**

Foundry is a high-leverage engineering system designed for developers and AI agents to manage multiple JavaScript/TypeScript projects at scale. It moves beyond "Tooling" into "Industrialization," providing a standardized factory floor, automated assembly lines, and a registry of operational protocols (Skills) for autonomous fleet management.

---

## 🏛️ The Five Pillars

### 1. The Standard (Tooling)
Standardize your entire fleet with versioned, shared configurations.
*   **`@saas-maker/eslint-config`**: Unified rules for Next.js, Vite, and Node.
*   **`@saas-maker/tsconfig`**: Strict, optimized TypeScript bases.

### 2. The Blocks (Shared Logic)
Headless capabilities that every project needs, optimized for Edge and Node.
*   **`@saas-maker/ops`**: Unified error handling and tracing.
*   **`@saas-maker/db`**: Environment-aware SQLite factory (D1/Turso).
*   **`@saas-maker/foundry-shield`**: Sliding-window rate limiting.

### 3. The Commander (CLI)
Automate your assembly line.
*   `fnd fleet run`: Parallel command execution across 22+ repos.
*   `fnd fleet audit`: Deep health checks (dead code, drift, debt).
*   `fnd fleet fix`: Automated correction of fleet-wide issues.

### 4. The Forge (Scaffolding)
Blueprint-based project creation.
*   `fnd forge`: Start "Foundry Compliant" projects in 5 seconds.
*   **Agent-Native**: Every project is born with an `AGENTS.md` foreman.

### 5. The Registry (Agent Skills)
The brain of the factory.
*   **`skills/`**: Standardized Markdown protocols that teach AI agents how to migrate, debug, and expand the fleet autonomously.

---

## 🚀 Quick Start

1. **Install the CLI**:
   ```bash
   pnpm add -g @saas-maker/cli
   ```

2. **Forge a Project**:
   ```bash
   fnd forge --name my-new-app --type next
   ```

3. **Link the Agent Hook**:
   Connect your global agent harness (e.g. Claude Code) to the Foundry Factory.
   ```bash
   # Add this to your shell profile or .claude/hooks
   source ./scripts/foundry-agent-hook.sh
   ```

4. **Audit the Fleet**:
   ```bash
   fnd fleet audit
   ```

---

## 📂 Repository Structure

*   `packages/tooling/`: Gold Standard configurations.
*   `packages/blocks/`: Operational Layer logic.
*   `packages/widgets/`: Modular UI blocks.
*   `skills/`: Agentic Operational Protocols.
*   `apps/cockpit/`: The Mission Control Dashboard (Next.js).
*   `apps/docs/`: The Factory Manual (Astro Starlight).
*   `apps/showcase/`: The Production Landing Page & Widget Showcase (Next.js).

---

## ⚖️ License

Open source under the MIT License.
