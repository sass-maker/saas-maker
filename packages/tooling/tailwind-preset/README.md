# @saas-maker/tailwind-preset

Foundry brand tokens — colors, spacing, type scale, radii, shadows. Ships both a Tailwind v4 `@theme` CSS file and a v3 JS preset so every Fleet app shares the same palette without copy-pasting `globals.css`.

## Install

```bash
pnpm add -D @saas-maker/tailwind-preset
```

## Tailwind v4

```css
/* app/globals.css */
@import "tailwindcss";
@import "@saas-maker/tailwind-preset/theme.css";
```

That's it — `bg-primary`, `text-muted-foreground`, `border-border`, `shadow-foundry-md`, `dark:` variant, etc. are all live.

### Overriding tokens for app brand

Tokens are scoped inside `@layer base`, so apps can override any subset by
declaring their own values in a `@layer base` block AFTER the import:

```css
@import "tailwindcss";
@import "@saas-maker/tailwind-preset/theme.css";

@layer base {
  :root {
    --primary: oklch(0.55 0.18 250);
    --primary-foreground: oklch(1 0 0);
    --radius: 0.5rem;
  }
  .dark {
    --primary: oklch(0.75 0.15 250);
  }
}
```

Anything you don't override falls back to foundry defaults. Because both
the preset's `:root` and your override live in `@layer base`, source order
wins — your `@layer base` block must come after the preset import.

## Tailwind v3

```ts
// tailwind.config.ts
import { foundryPreset } from '@saas-maker/tailwind-preset';
import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [foundryPreset],
} satisfies Config;
```

## Tokens (programmatic)

```ts
import { colors, colorsDark, spacing, baseRadius } from '@saas-maker/tailwind-preset/tokens';

console.log(colors.primary); // 'oklch(0.205 0 0)'
```

## Token reference

| Group | Keys |
|---|---|
| Surface | `background`, `foreground`, `card`, `popover`, `muted`, `border`, `input`, `ring` |
| Action | `primary`, `secondary`, `accent`, `destructive` (each with `*-foreground`) |
| Charts | `chart1` … `chart5` |
| Radii | `sm`, `md`, `lg`, `xl`, `2xl` (derived from `--radius: 0.625rem`) |
| Shadows | `foundry-xs`, `foundry-sm`, `foundry-md`, `foundry-lg`, `foundry-xl` |

## Dark mode

`theme.css` ships a `.dark` selector. Pair with `next-themes` or any `class="dark"` toggle.
