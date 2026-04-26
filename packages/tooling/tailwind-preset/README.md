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
