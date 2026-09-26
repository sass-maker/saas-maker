---
name: whimsy
description: >
  Insert tasteful whimsy into a product — copy tweaks, microcopy, and small
  interaction ideas that make people smile without trying hard, on-brand.
  Proposes a numbered pick-list first; the user chooses which to implement.
  Use for "add whimsy", "make it more fun/playful/delightful", "inject
  personality", "surprise and delight", "this feels sterile/corporate",
  "liven up the empty states", "the 404 is boring", "make this less serious".
---

# whimsy — earned delight, not confetti

A blank slate becomes a tiny invitation; a 404 becomes a small joke; a
success toast lands with a wink. The flicker of "oh, someone *made* this" is
the whole product.

**Whimsy done wrong is worse than none.** A forced pun, 🎉 on every button,
"Hang tight, magic is happening!" reads as trying too hard — the opposite of
charm. Most of the skill is restraint: knowing which surfaces to leave alone,
proposing five great moments instead of forty mediocre ones.

## Output contract

**You propose → the user picks → you implement.** Never edit forty strings
and hand back a changed codebase — it's their brand; they need the veto
before it ships.

1. **Calibration flight** (unless the user set the level): show one
   representative surface at all three levels so they can feel the range —
   keep it to one small exchange.
2. **Numbered list** at the chosen level; user replies "do 2, 5, 9"; only
   then change anything.

## Read the room

**Voice** (in order): brand/voice doc (`**/brand.md`, `.seo/brand.md`,
`**/STYLE.md`, `**/voice*.md`, `.agents/product-marketing-context.md`, a
Voice/Tone section in AGENTS.md/README — if it exists it's law, including
forbidden words); else the existing copy — additions must sound like the same
person on a slightly better day.

**Ceiling:**

- **High** — consumer apps, indie products, games, joy-as-purpose. Whimsy can
  be personality.
- **Medium** — most SaaS/productivity/B2B. Corners only: empty states, 404,
  occasional success moment. Core workflow stays calm.
- **Low** — money, health, security, legal, grief, compliance. Driest corners
  only; when in doubt, propose less.

## Levels

- **Subtle** — dry warmth, light touch, nothing that announces itself as A
  Joke. Safe default; where medium/low ceilings sit.
- **Playful** — clearly having fun, puns allowed, some character.
- **Bold** — mascots, easter eggs, motion flourishes. Only when the brand is
  already there. Bold unlocks new *kinds* of suggestions, not just louder
  wording.

## Where to look

Empty states, 404s, success confirmations, loading waits, onboarding
first-run, footers, about pages, error messages that are already safe (never
make a payment failure cute), tooltips, Easter-eggable corners. Stay away
from: forms doing work, checkout/payment, destructive confirmations,
accessibility-critical text, legal.

## List format

`# · surface · current → proposed · level · why it earns the smile`. Mark any
suggestion that touches a regulated or high-stakes flow as opt-in. After the
user picks, implement and verify the copy renders where promised.
