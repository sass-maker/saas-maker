---
name: clarity-audit
description: >
  Audit a UI for the places a first-time user stalls, guesses, or picks the
  wrong thing, then propose the copy that fixes it. Finds unlabeled actions
  ("Continue" to where?), clever internal feature names, option sets with no
  basis for choosing, dead ends after an action, empty states with no on-ramp,
  hidden prerequisites, leaked internal jargon. Use for "clarity audit",
  "usability audit", "is this clear to a new user", "this UI is confusing",
  "our copy is vague", "what does this button even do". Output is a numbered
  list of proposed changes; the user picks which to apply.
---

# clarity-audit — curse of knowledge

Every place the product makes sense to the person who built it and to nobody
else. The bar: **a competent person, first session, no docs, no demo** — they
quietly leave instead of asking.

The opposite failure is real: a UI drowning in tooltips is worse than a terse
one. Most findings should end in *fewer or better words*, not more. Forty new
strings means the pass went wrong.

## Scope

- `$ARGUMENTS` names a path/route/flow → audit only that.
- Empty → pick the highest-value target (signup, onboarding, first object
  creation, main dashboard) and announce it. Whole-app sweeps produce lists
  too long to act on.
- Exclude build output, tests, admin-only screens.

## Get the surfaces

- **Code first**: user-facing strings by stack — JSX/`.tsx` + `en.json`,
  `.vue`/locales, `.svelte`/`$lib/i18n`, ERB + `config/locales`, Django
  `help_text`/`.po`, Blade/`lang`, HEEx/gettext, `Text("…")`/`Localizable`,
  `.arb`. The i18n file is the fastest complete inventory — then trace keys
  to where they render. Never audit a string without its screen context.
- **Rendered beats source**: use the `terminal-browser` skill (or Safari MCP,
  an existing dev server, pasted screenshots) to see what a user sees — label,
  neighboring options, empty panel, disabled button. If nothing's available,
  say so in one line and audit from source.
- **Also read**: landing page, README, docs — the plain-language explanation
  of a feature often already exists there and is the exact fix.

## The cold read — per screen

Cover the code. Read only what renders, in eye order. Answer out loud:

1. What is this screen for? (one sentence, from the screen alone)
2. What does each control *do* — to my data, my account?
3. If there's a choice, on what basis do I choose?
4. What happens after I act — where do I land, is it reversible, what's next?

A question answerable only from source = a finding. Never audit from memory
of code you just read — answer from the render, then confirm the gap in
source.

## Finding shapes

Unlabeled/ambiguous actions; clever internal names; option sets with no
distinguishing info; post-action dead ends; empty states with no on-ramp;
hidden prerequisites (disabled with no reason); leaked jargon/slugs/IDs;
defaults with no stated tradeoff; destructive actions with no consequence
hint.

## Output

Numbered list: `screen · the guess a user must make · smallest wording change
that removes it`. The user picks; then edit. Keep changes minimal — a better
label beats a paragraph of helper text.
