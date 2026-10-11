# SaaS Maker public directory

## Direction

The landing and every public route share the dark App Health/cockpit direction.
Quiet cards frame the product directory, packages, tools, and studio journal.
Keep the existing copy, hierarchy, routes, evidence, and analytics intact.

## Tokens

- Background: `#0a0a0a`; cards: `#171717`; muted surface: `#262626`.
- Foreground: `#fafafa`; supporting text: `#e5e5e5`; muted text: `#a1a1a1`.
- Hairline border: `#222222`; card and control radius: `10px`.
- Copper actions: `#d57a43`, hover/focus `#ef9b66`, with `#0a0a0a` text.
- Neutral secondary actions: `#e5e5e5` with `#0a0a0a` text.
- Destructive text: `#ff6467`; keyboard focus ring: copper highlight.

Ledger plaques flood on hover and keyboard focus: cobalt `#1746a2` or oxblood
`#7b211c` with opaque white text; amber `#c9820d` with `#0a0a0a` text.
All plaque metadata inherits the same foreground. Accent colors are fills for
these states, not low-contrast text on the dark ground.

## Typography

Use self-hosted Geist for prose and headings, and Geist Mono for event,
package, and tool names, code, and chips. The unchanged latin variable cuts
come from Next's devtools font directory; `public/fonts/OFL.txt` retains the
upstream SIL OFL notice. Preload the sans face and use `font-display: optional`.

The Arial fallback is calculated from the shipped Geist and local Arial
hmtx/hhea tables with a frequency-weighted lowercase sample. Its size adjustment
is `106.3855%`, ascent `94.4678%`, descent `27.7293%`, and line gap `0%`.
The calculation is recorded beside the face in `src/styles/globals.css`.
Recompute those values if the font cut changes. Preserve existing capitalization.

## Composition and motion

Cards replace the old glass wall and heavy steel mullions; hairline gaps keep
related panes legible. Directory rows and details use the same dark surfaces.
Each section has one focal visual. The hero keeps the existing atelier crop
under a near-opaque dark mask, behind semantic HTML; other reading surfaces
use solid cards. Preserve the dark TokenWorld scene and its accessible fallback.

Existing responsive reading order and native disclosures remain. Check at
390, 768, and 1440px with no page overflow. Keep readable text at WCAG AA,
visible copper keyboard focus, and reduced-motion behavior. Entrance motion
moves cards subtly without dimming their text.
