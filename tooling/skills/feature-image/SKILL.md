---
name: feature-image
description: >
  Generate a branded social/OG image announcing a feature or update —
  auto-detects the product's fonts, colors, and logo from the codebase,
  renders a 1200×630 card, and captures it in a real browser. Use for "make
  an OG image", "feature announcement image", "social card", "share image",
  "og:image for this page".
---

# feature-image — branded 1200×630 social card

## Method

1. **Brand detection** — read the codebase, don't guess:
   - Colors: CSS custom properties, Tailwind config, theme tokens.
   - Fonts: `@font-face`, Google Fonts links, `font-family` stacks.
   - Mark: `public/` logo, favicon source, brand assets dir.
   - Name/tagline: the site's `<title>`, hero copy, or catalog
     `presentation` entry.
2. **Compose the card** as a standalone HTML file (e.g. `og-card.html` in a
   scratch dir — not committed unless the repo wants it):
   - 1200×630 viewport, the product's background/foreground/accent.
   - The product mark + name; one headline (the feature); optional one-line
     sub. Generous margins — social crops eat edges (~40px safe inset).
   - Match the site's actual voice; if `design-workflow` tokens exist for
     the product, reuse them.
3. **Capture** with the `terminal-browser` skill: serve or `file://` the
   HTML at exactly 1200×630, screenshot → `<name>-og.png`. Zero console
   errors; fonts must have finished loading (wait for `document.fonts.ready`
   or a short settle delay).
4. **Place + wire**:
   - Output to the site's public dir (e.g. `public/og/<slug>.png`).
   - Per-page: `<meta property="og:image" content="<absolute-url>">` +
     `og:image:width/height`, `twitter:card` = `summary_large_image`.
     Absolute URL required — derive the canonical origin from the catalog
     domain.
   - Site-wide default: the layout/head component.
5. **Verify** — fetch the deployed page (or local render) and confirm the
   og:image URL resolves 200 and the meta tags are present. If the product
   has a `/og` or social-preview debug route, use it.

Report the artifact path, the pages wired, and the absolute og:image URL.
