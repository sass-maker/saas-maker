---
name: favicon
description: >
  Generate a complete favicon set from a source image — 16/32/48 PNGs,
  apple-touch-icon (180), Android sizes (192/512), favicon.ico, and the
  correct <link> tags wired into the site's HTML/head. Use for "make a
  favicon", "generate favicons", "the site has no icon", "add an app icon".
---

# favicon — source image → full icon set

## Method

1. **Find or ask for the source.** Highest resolution available: logo PNG/SVG,
   brand asset dir, `public/` art, or ask the user. SVG or ≥512px PNG is ideal.
   If the source isn't square, pad to square on a solid or transparent canvas —
   never stretch.
2. **Rasterize** at each size. On macOS `sips` covers PNG→PNG:
   `sips -z <h> <w> src.png --out icon-32.png`. For SVG sources, render via the
   `terminal-browser` skill (open the SVG, screenshot the element at target
   size) or `qlmanage -t -s <size>`. If ImageMagick is installed
   (`command -v magick`), prefer `magick src.png -resize <s>x<s>`.
3. **Emit the set** into the site's public/static dir:
   - `favicon-16x16.png`, `favicon-32x32.png` (taskbar/tab)
   - `apple-touch-icon.png` (180×180)
   - `android-chrome-192x192.png`, `android-chrome-512x512.png`
   - `favicon.ico` — a real multi-size ICO if `magick` exists
     (`magick 16.png 32.png 48.png favicon.ico`); otherwise copy the 32px PNG
     to `favicon.ico` and note it (browsers tolerate PNG-in-.ico)
   - `site.webmanifest` if the stack uses one (`{"name","short_name","icons",…}`)
4. **Wire the head** — match the framework's head mechanism:

   ```html
   <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
   <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
   <link rel="apple-touch-icon" href="/apple-touch-icon.png">
   <link rel="manifest" href="/site.webmanifest">
   ```

   Astro: `src/pages/*.astro` or a `<head>` layout component + `public/`.
   Next.js: `app/icon.png` + `app/apple-icon.png` conventions beat manual tags.
   Plain HTML: the layout template. Check what convention the repo already
   uses and follow it.
5. **Verify** — serve the site (or the deployed URL), confirm
   `/favicon-32x32.png` returns 200 and the tab icon renders. Check dark tab
   bar contrast — a transparent dark glyph disappears on dark chrome; if the
   mark is dark, ship it on a light tile.

Report the files written, where they're wired, and anything left manual
(e.g. ICO fallback used).
