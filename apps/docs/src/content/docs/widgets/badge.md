---
title: Badge Widget
description: Add a "Built with SaasMaker" badge to your site.
---

A small badge component that links back to SaasMaker. Drop it in your footer to credit the toolkit.

## Installation

```bash
npm install @saas-maker/badge
```

Peer dependencies: `react` and `react-dom` (v18+).

## Usage

```tsx
import { SaasMakerBadge } from '@saas-maker/badge';

function Footer() {
  return <SaasMakerBadge variant="flat" theme="auto" />;
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'flat' \| 'outlined' \| 'small'` | `'flat'` | Badge style |
| `theme` | `'light' \| 'dark' \| 'auto'` | `'auto'` | Color theme (`auto` uses `prefers-color-scheme`) |
| `href` | `string` | `'https://sassmaker.com/made-with'` | Link target |

## Variants

- **Flat** — light background with border, shows "Built with SaasMaker" text
- **Outlined** — transparent background with border, shows text
- **Small** — icon-only, no text label

## HTML (non-React)

Use the `getBadgeHtml` helper to generate a standalone HTML snippet:

```typescript
import { getBadgeHtml } from '@saas-maker/badge';

const html = getBadgeHtml({ variant: 'flat', theme: 'light' });
// Returns an <a> tag with inline styles — paste into any HTML page
```

Or use this HTML directly:

```html
<a href="https://sassmaker.com/made-with" target="_blank"
   style="display:inline-flex;align-items:center;gap:6px;padding:5px 10px;
          background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;
          text-decoration:none;font-family:sans-serif;font-size:12px;
          font-weight:500;color:#475569;">
  Built with SaasMaker
</a>
```

## Theming

All styles are handled via CSS classes. The `auto` theme uses `prefers-color-scheme` to match the user's system preference.

```tsx
{/* Matches system dark/light mode */}
<SaasMakerBadge variant="flat" theme="auto" />

{/* Force dark theme */}
<SaasMakerBadge variant="outlined" theme="dark" />
```

## TypeScript

The package exports all types:

```typescript
import type { BadgeProps, BadgeVariant, BadgeTheme } from '@saas-maker/badge';
```
