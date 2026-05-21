# Mobile conventions

Mobile-polish standard for fleet projects. Extracted from the `resume-tailor`
pilot (Wave 1-E).

**Definition of done:** every *primary* flow is usable one-handed at a 390px
viewport — no horizontal scroll, no overlap, every tap target reachable.

## Target viewport

- **390px wide** is the design target (iPhone 13 / 14 / 15 — the most common
  modern phone width). If it works at 390px it works wider.
- The Playwright `mobile` project (see `playwright.config.ts.template`) uses
  the `iPhone 13` device descriptor = 390px — so the CI viewport matches the
  design target exactly.
- Spot-check 360px (smaller Android) for anything that looks tight.

## Touch targets

- **Minimum 44 x 44 px** for anything tappable — buttons, links, icon
  buttons, checkboxes, menu items. This is the iOS Human Interface Guideline
  and a WCAG 2.5.5 baseline.
- Small visual icon? Keep the icon small but pad the hit area to 44px (Tailwind
  `p-3` on a ~20px icon ≈ 44px; or `min-h-11 min-w-11`, since `11` = 44px).
- Space adjacent targets so a thumb can't hit two at once (~8px gap minimum).

## Layout rules

- **No horizontal scroll.** The page must never scroll sideways at 390px.
  Common causes: fixed-width elements, wide tables, un-wrapped `flex` rows,
  negative margins, `100vw` with a scrollbar.
- **Stack to single column** below the `md` breakpoint — card grids, pricing
  tables, multi-step flows, dashboards.
- **No overlap.** Sticky headers, modals, toasts, and FABs must not cover
  content or each other.
- **Multi-step flows go single-column** on mobile — one step per screen.
- **Navigation collapses to a hamburger** below `md`.

## Tailwind breakpoint guidance

Tailwind is **mobile-first**: unprefixed utilities apply at all widths;
prefixed utilities (`sm:`, `md:`, ...) apply *from that width up*.

| Prefix | Min width | Use for |
|---|---|---|
| *(none)* | 0px | The mobile (390px) layout — this is the default. |
| `sm:` | 640px | Large phones / small tablets. |
| `md:` | 768px | Tablet — the usual mobile/desktop switch point. |
| `lg:` | 1024px | Desktop. |
| `xl:` / `2xl:` | 1280 / 1536px | Wide desktop. |

Rules of thumb:

- **Write the 390px layout first**, unprefixed. Add `md:` / `lg:` to *expand*
  to desktop — never the other way round.
- Default to single column; widen with `md:grid-cols-2` etc.
  - `grid grid-cols-1 md:grid-cols-3`
  - `flex flex-col md:flex-row`
- The mobile/desktop divide for this fleet is **`md` (768px)** — hamburger nav,
  side-by-side → stacked, etc., all flip at `md`.
- Constrain text width (`max-w-prose` / `max-w-md`) so copy doesn't run
  edge-to-edge on a phone.
- Use responsive padding: `p-4 md:p-8`, not a fixed large pad.

## "Hard" components

Each project has at least one component that resists mobile layout — rich
editors, diff views, drag-and-drop timelines, virtualized grids, maps. These
must be **explicitly verified at 390px**, not assumed. Typical fixes:

- Side-by-side diff → inline / stacked diff below `md`.
- Code editor → scrollable, wrapping toolbar, legible font size.
- Wide data grid → horizontal scroll *inside the component only* (never the
  page), or a card layout on mobile.
- Drag-and-drop → ensure drag handles are ≥44px and reachable.

Reference: `resume-tailor`'s Monaco diff (`resume-diff.tsx`) and CodeMirror
editor (`resume-editor.tsx`).

## Verifying

- Add a Playwright e2e for the primary flow that runs under the `mobile`
  project (see `playwright.config.ts.template`).
- `pnpm exec playwright test --project=mobile` runs only the mobile viewport.
- Manual check: real device or browser devtools at 390px — exercise the whole
  primary flow one-handed.
