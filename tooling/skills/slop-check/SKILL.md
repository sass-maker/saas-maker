---
name: slop-check
description: Detect AI slop, the stock outputs of generative tools, in interfaces, copy, and docs. Use when reviewing a rendered page, diff, design, or prose for AI tells (gradients everywhere, pulsing badges, icon-tile cards, glassmorphism, hype taglines, not-X-but-Y cadence, em-dash saturation, chatbot residue), when the owner calls something slop, generic, or vibe-coded, or before shipping agent-produced UI or text. Advisory detection only; rewrites belong to humanizer and design-workflow.
---

# Slop check

Slop is the model-default choice: what a generator produces when nobody makes
a decision. A tell counts in proportion to how rarely a careful author picks
it on purpose. Several weak tells together outweigh one strong one, and any
single tell can be deliberate. Project `DESIGN.md`, `PRODUCT.md`, and the
brief outrank every pattern below. Never redesign only to silence a tell or
lower a score.

## Workflow

1. Pick the lane by surface:
   - **Rendered web page:** run the mechanical scan below, then read the page
     against the interface tells. The scanner misses prompt-smell copy,
     misalignment, and meaningless badges, so a Clean score is not a pass.
   - **Source or diff:** check markup, CSS, and copy against both tell lists.
   - **Prose or docs:** check against the prose tells.
2. Record each tell with its location and concrete evidence. Split findings
   into *violates the brief* (fix) and *plausibly intentional* (flag, keep).
3. Report concisely: tell, where, why it reads as a default, suggested fix.
   Detection is the deliverable; do not rewrite unless asked. Route prose
   rewrites to `humanizer` and UI fixes to `design-workflow`/`impeccable`.

## Mechanical scan

```sh
node <tooling-root>/scripts/slop-score.mjs setup         # once per machine
node <tooling-root>/scripts/slop-score.mjs <url> --json  # design axis
node <tooling-root>/scripts/slop-score.mjs <url> --copy  # adds copy axis
```

`<tooling-root>` is `saas-maker/tooling` in this workspace. The runner wraps a
pinned local slop-detect in headless Chromium at a fixed 1280x800 viewport.
Design score bands: 0-9 Clean, 10-27 Mild, 28+ Heavy. These are advisory
labels, not a grade. Exit 1 means the scan failed and the result is unknown,
not Heavy. Compare scores only across the same pin, preset, viewport, and page
state. The design-system alignment score has opposite polarity: higher is
better. Full contract: [slop-score doc](../../docs/slop-score.md). For deeper
source and rendered checks, use the `impeccable` detector.

## Interface tells

Merged from godObject's "10 tells of a slop UI" and impeccable's antipattern
registry, roughly strongest first.

**Color and surface**

- Gradients as decoration: on buttons, text, backgrounds, anything that will
  hold one, purple and violet above all. Includes gradient text, chromatic
  radial halo washes, and colored glow shadows on dark surfaces.
- Rainbow vomit: hues that exist only to distinguish fields, with no
  70-30-10 discipline. Also the reflex palettes: purple-on-dark,
  cyan-on-dark, and cream/beige as the default "tasteful" surface.
- Off-the-shelf design language: glassmorphism everywhere, or a brutalist
  theme identical to every other brutalist theme.

**Components**

- Pulsing badges and fake liveness: pulsing dots, "Active" or "Verified"
  badges that can never be otherwise, blinking cursors where nothing is
  typed. Animation must map to state that actually changes.
- Card templates: cards inside cards; the rounded icon-tile-above-heading
  feature card; tall narrow "fingernail" cards; thick one-side accent
  borders; accent borders clashing with rounded corners.
- Hero scaffolding: tiny uppercase eyebrow or pill chip over an oversized
  sentence-length headline; repeated section kickers; numbered section
  labels acting as editorial scaffolding.
- Emoji slop: emojis as bullets, section decoration, or feature icons.
- Misaligned anything: SVG, ASCII art, or unboxed elements sitting off-grid.

**Typography**

- Font defaults: Inter, Roboto, Geist, Plus Jakarta Sans, Space Grotesk, or
  Fraunces on everything; JetBrains Mono for anything tech-adjacent;
  `//` faux-comments used as decoration. Also: a single family with no
  hierarchy, a flat size ramp, italic-serif display heroes, letter-spacing
  crushed past legibility.

**Motion**

- Bounce or elastic easing; auto-scrolling marquees; entrance animations that
  gate content visibility. Real objects decelerate: use ease-out.

**Layout rhythm**

- The same spacing value everywhere, no grouping contrast; uniform grids
  where hierarchy should vary.

**Hype and residue copy in UI**

- Tagline slop: Elevate, Seamless, Supercharge, Unleash, Empower,
  Next-Generation, cutting-edge; "Welcome to your Dashboard, [Name]"; a grey
  subline under every H1; every screen treated like a landing page rather
  than a tool.
- Prompt smell: text that exists only because of the chat context, like
  "Built with Hugo. Written from Neovim" or "One campus. One app." Test:
  can you reconstruct the prompt from the copy?

## Prose tells

Condensed from `humanizer`, which is based on Wikipedia's "Signs of AI
writing". Use that skill for the rewrite itself. Strong tells justify a flag
on one sighting; weak ones need company in the same passage.

**Staging instead of stating** (act on one sighting)

- "Not X but Y" / "not just X" contrasts, including the contrast split across
  two sentences and clipped negative tails ("..., no guessing").
- One-line closers and dramatic fragments: "That is the real win.", "Let that
  sink in.", the same closer repeated after each section.
- Sayings that sound deep: "the real question is", "at its core", "X is the
  Y of Z", "a testament to".
- Staged run-ups: "Let's dive in", "Here's the thing", "Honestly?".
- Arguing with no one: "I'm not saying", "to be clear", fake alternatives and
  objections nobody raised.

**Rhythm by rule**

- Forced triads; several sentences opening on the same subject; em-dash
  saturation (roughly one per 500 characters of body text); stacked
  qualifiers ("could potentially arguably"); compound modifiers keeping their
  hyphen after the noun ("the report is high-quality"); dropped subjects.

**Inflation and borrowed authority**

- Stock AI words: delve, crucial, pivotal, enhance, robust, intricate,
  tapestry, landscape, testament, underscore, showcase, garner, vibrant.
- Inflated significance: "marking a pivotal moment", "the future looks
  bright", stock "challenges and outlook" sections.
- Vague connections ("associated with", "linked to"); shallow -ing riders
  ("highlighting", "underscoring", "reflecting"); sales language ("nestled",
  "breathtaking", "renowned"); unnamed "experts" and prestige-outlet lists;
  "serves as" and "boasts" where is/has would do.

**Formatting by rule**

- Bold labels on every list item; title-case or emoji-decorated headings;
  a rule between every section; a heading restated as its own first
  sentence.

**Leftovers**

- Chatbot residue: "Great question!", "I hope this helps", "Let me know if".
- Knowledge-limit disclaimers that become guesses ("not publicly documented,
  suggesting...").
- The document narrating itself: "this section is organized by", "compiled
  from".

**Wrong reader**

- Re-explaining context the reader already has; the decision or answer buried
  in the last line.

## Reporting

Group findings by tell, cite file:line or rendered location, and mark each
*fix* or *intentional-ok* with a reason. When the user asked only for
detection, stop at the report.
