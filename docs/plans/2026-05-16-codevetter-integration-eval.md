# Evaluation: Merging or Linking CodeVetter with SaaS Maker

**Date:** 2026-05-16
**Status:** Recommendation

## 1. Audit of Overlap

| Feature | SaaS Maker (Cockpit/Foundry) | CodeVetter | Overlap |
| :--- | :--- | :--- | :--- |
| **Product Goal** | Platform for building/operating SaaS fleet. | AI-powered code review platform. | CodeVetter is a product *within* the SaaS Maker fleet. |
| **UI Patterns** | Web Dashboard (Next.js), shared UI components. | Desktop App (Tauri/Vite), specialized for code. | High potential for shared design system. |
| **Auth** | Centralized `better-auth` (Google) + D1 sessions. | Independent/Local (needs unification). | Unifying auth simplifies user experience. |
| **Concepts** | Projects, Tasks (Symphony), Feedback. | Code Reviews, AI Feedback. | Code Reviews are specialized Symphony Tasks. |
| **Infrastructure** | Cloudflare (D1, Workers, R2, Pages). | Cloudflare (D1, Pages) + Desktop local. | Same backend stack. |

## 2. Comparison of Options

### Option A: Full Product Merge
*   **Description:** CodeVetter becomes a feature within the SaaS Maker Cockpit (Web).
*   **Pros:** Single UI, single deployment, zero context switching.
*   **Cons:** Losing the "desktop-first/offline" advantage for code review; browser-based code editors are often less performant than local tools.

### Option B: Deep Linking & Shared Auth (Recommended)
*   **Description:** CodeVetter remains a specialized desktop application but is merged into the SaaS Maker monorepo and shares auth/API.
*   **Pros:** Best of both worlds. Specialized desktop UI for code reading; centralized task/identity management in SaaS Maker.
*   **Cons:** Requires maintaining two distinct frontend apps (Web + Desktop).

### Option C: Keep Separate
*   **Description:** Status quo.
*   **Pros:** Low friction today.
*   **Cons:** Duplicated effort for auth, UI, and maintenance.

## 3. Recommended Path: The "Foundry Client" Model

We should treat CodeVetter as the **specialized desktop client** for SaaS Maker's task system, specifically for code review.

1.  **Code Migration:** Move CodeVetter source into `apps/codevetter` in the `saas-maker` monorepo.
2.  **Standardize Tooling:** Use `@saas-maker/ui`, `@saas-maker/eslint-config`, and `@saas-maker/tsconfig`.
3.  **Unify Identity:** CodeVetter should accept SaaS Maker session tokens (provided via CLI or deep link).
4.  **Shared Persistence:** Migrate CodeVetter "Reviews" to be Symphony Tasks with a `task_type: 'review'` and custom metadata for diffs.
5.  **Cockpit Integration:** Add "Open in CodeVetter" links to tasks with PR URLs.

## 4. Migration Risks & Effort
*   **Effort:** Medium (24-40 hours). Most work is in refactoring CodeVetter to use shared packages and the SaaS Maker API.
*   **Risks:** Breaking existing CodeVetter users (needs a migration script for their D1 data if they aren't already using SaaS Maker auth).

## 5. First Implementation Step: "The Deep Link"

Add an **"AI Review"** button to the SaaS Maker Cockpit Tasks board. This button uses a `codevetter://review?url=...` protocol handler. This establishes the product link without requiring immediate code refactoring.

```tsx
// Example link in TaskBoard.tsx
{task.pr_url && (
  <a
    href={`codevetter://review?url=${encodeURIComponent(task.pr_url)}`}
    className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-emerald-600 hover:border-emerald-500/60"
  >
    AI Review <Play className="h-3 w-3" />
  </a>
)}
```
