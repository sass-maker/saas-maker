# Error kit

Reusable error-handling assets for fleet projects. Extracted from the
`resume-tailor` pilot (Wave 1-E). Goal: **no failure is ever a silent blank
screen, and no stack trace is ever shown to a user.**

## What's in here

| File | Drop it at | For |
|---|---|---|
| `error.tsx.template` | `src/app/error.tsx` + any heavy `src/app/<segment>/error.tsx` | Next.js App Router route-segment error boundary |
| `global-error.tsx.template` | `src/app/global-error.tsx` | Next.js root-layout error boundary (the layer `error.tsx` can't reach) |
| `not-found.tsx.template` | `src/app/not-found.tsx` | Next.js 404 page |
| `loading.tsx.template` | `src/app/<segment>/loading.tsx` | Next.js slow-route loading state (companion to `error.tsx`) |
| `capture-error.ts.template` | `src/lib/capture-error.ts` | The shared capture sink — `captureError()` + global listeners |
| `ErrorBoundary.tsx.template` | `src/components/ErrorBoundary.tsx` | React `<ErrorBoundary>` for Vite SPAs (no file-based boundaries) |

All `.template` files are plain TS/TSX with a `.template` suffix so they are
not picked up as live routes inside `saas-maker`. **Strip the `.template`
suffix when you copy a file into a project.**

## Principles

1. **Never render `error.message` to users.** It can leak server internals
   (DB errors, file paths, secrets in messages). Show fixed friendly copy.
2. **Always capture.** Every boundary routes through `captureError()` so the
   failure lands in PostHog. No `console.error`-only handling.
3. **Always surface `error.digest`.** It's the only safe, user-shareable
   reference that ties a screenshot back to a server log.
4. **Heavy routes ship both `error.tsx` and `loading.tsx`** — failure path and
   slow path are both covered.
5. **Catch what escapes React too.** `installBrowserMonitoring()` wires
   `window.onerror` + `unhandledrejection` so non-React crashes are not silent.

## Wiring it up — Next.js App Router

1. Copy `capture-error.ts.template` → `src/lib/capture-error.ts`. Fill the
   placeholders: `PROJECT_SLUG`, the PostHog env vars, and extend the
   `ErrorBoundaryScope` union with this project's route trees.
2. Copy `error.tsx.template` → `src/app/error.tsx`; set `scope: "root"`.
3. Copy `global-error.tsx.template` → `src/app/global-error.tsx`.
4. Copy `not-found.tsx.template` → `src/app/not-found.tsx`.
5. For each heavy route segment (scraping / AI / large DB read), copy
   `error.tsx.template` into `src/app/<segment>/error.tsx` with a segment-
   specific `scope` and copy, and copy `loading.tsx.template` into
   `src/app/<segment>/loading.tsx`.
6. Install global monitoring once, from a top-level client component:

   ```tsx
   "use client";
   import { useEffect } from "react";
   import { installBrowserMonitoring } from "@/lib/capture-error";

   export function MonitoringProvider({ children }: { children: React.ReactNode }) {
     useEffect(() => installBrowserMonitoring(), []);
     return <>{children}</>;
   }
   ```

   Render `<MonitoringProvider>` in the root layout (typically alongside the
   PostHog provider).

## Wiring it up — Vite SPA

Next.js file-based boundaries don't exist here. Instead:

1. Copy `capture-error.ts.template` → `src/lib/capture-error.ts`. In a Vite
   app swap the `process.env["NEXT_PUBLIC_*"]` reads for
   `import.meta.env["VITE_*"]`.
2. Copy `ErrorBoundary.tsx.template` → `src/components/ErrorBoundary.tsx`.
3. Wrap the app root, and optionally any risky subtree:

   ```tsx
   import { ErrorBoundary } from "./components/ErrorBoundary";

   createRoot(document.getElementById("root")!).render(
     <ErrorBoundary>
       <App />
     </ErrorBoundary>,
   );
   ```
4. Call `installBrowserMonitoring()` once in `main.tsx`.

## API/network failure states (not a file — a rule)

The error kit covers render-time crashes. It does **not** cover a `fetch` that
fails. Every API/network call still needs its own failure state:

- A retry affordance (button or automatic backoff).
- A user-facing message — never a silent blank or an infinite spinner.
- For PWAs: an explicit offline state.

Route the caught error through `captureError()` so it's still observable. See
the `resume-tailor` scrape/AI actions for the reference pattern (typed failure
result → UI renders a retry + manual-fallback).

## Reference implementation

`resume-tailor`: `src/app/error.tsx`, `global-error.tsx`, `not-found.tsx`,
per-route `error.tsx` / `loading.tsx` files, and `src/lib/foundry-monitoring.ts`
(the `captureError()` original).
