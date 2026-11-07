# Fleet web UI standard

## One library

**Owner decision (2026-10-09):** Fleet web surfaces use one UI library,
[shadcn/ui](https://ui.shadcn.com/) (Radix primitives + Tailwind). This covers
landing pages, product apps, docs chrome, dashboards, and internal tools. Do
not mix in a second component library or introduce another one per project.

The goal is solid, consistent basics everywhere. A product reads as itself
through its tokens and imagery, not through a different component system.

- Components: https://ui.shadcn.com/docs/components
- Blocks (marketing, dashboards, auth, sidebars): https://ui.shadcn.com/blocks
- Theming via CSS variables: https://ui.shadcn.com/docs/theming

Apple-native interfaces use Apple frameworks and are outside this web standard.

## Where products differ

Keep the components standard and put the variety in a few places:

1. **Tokens.** Each product sets its own `--primary`, `--accent`, radius,
   surface colors, and one or two typefaces in the shadcn CSS variables. That is
   the whole per-product theming layer. Don't fork component internals for
   style.
2. **Imagery: be creative here.** Illustration, photography, product artwork,
   generated art, mascots, textures, and hero visuals should be distinctive per
   product. That is where Fleet sites earn character. A plain shadcn layout with
   strong product imagery beats a bespoke layout with generic imagery.
3. **Copy and real product proof.** Use real screens, data, and outcomes, not
   gallery filler.

Animated text/background effects (for example [React Bits](https://reactbits.dev/),
checking its MIT + Commons Clause license) count as imagery. Use them only in
the hero or one signature moment, never as routine dashboard decoration.

## Exceptions: bespoke designs

Only products whose design is clearly better than a tokenized shadcn baseline
keep their own design. The owner grants these; agents do not add to the list.

<!-- BESPOKE_LIST -->

A bespoke product still uses shadcn/Radix for its standard controls (dialogs,
menus, forms, tables) unless the existing system already owns them well. Its
bespoke part is the layout, type, and art direction.

## Applying it

- **New surface:** start from shadcn components and blocks with the product's
  tokens. Install components with the shadcn CLI (`components.json`), which
  copies source into the repo rather than adding a runtime library.
- **Astro or other static landings:** use the same shadcn token CSS and the same
  component class recipes in `.astro` markup. Add a React island only for a
  component that needs behavior (dialog, menu, combobox, sheet). Do not add
  React to a static page just to render buttons or cards.
- **Existing surface on another system (Preline, hand-rolled, other library):**
  move it to shadcn when the surface is being materially changed, or in an
  owner-approved migration pass. Don't rewrite an untouched healthy page as a
  side effect of unrelated work.
- **Need something shadcn lacks:** first compose it from shadcn/Radix parts.
  Then check [shadcnblocks](https://www.shadcnblocks.com/) (verify free/paid
  access and license) or a shadcn-registry component on
  [21st.dev](https://21st.dev/) (inspect source, license, dependencies). A fully
  custom pattern needs owner authorization and a recorded gap.
- **Motion:** use [Transitions.dev](https://transitions.dev/) CSS patterns (via
  the `transitions-dev` skill when installed) for open/close and state changes.
  Respect reduced motion.

Retired as defaults (2026-10-09): Tailwind Plus/Catalyst, Preline, coss UI,
beUI, Spectrum UI, Rare UI, 8bitcn, and Evil Charts. Don't start new work on
them.

## Runtime and dependency rules

- Copied shadcn component source is the norm; keep only the components a
  surface uses.
- Never store account credentials, license keys, or paid source in shared Fleet
  tooling. Buying a license is a separate spend action that needs owner
  approval.
- Do not add a production dependency, paid tool, or licensed asset without
  owner approval.

## Priority-scaled delivery depth

Use the canonical `identity.priority` in Site Health to decide how much craft
and validation time a surface receives. Priority changes depth, not
truthfulness or basic usability.

- **P1 / flagship:** product-specific composition and proof artifact on the
  standard components, complete interaction states, all three responsive
  viewports, and the strongest project checks.
- **P2 / active:** polished production quality and recognisable identity from
  tokens and imagery. Standard responsive, rendered-review and project checks.
- **P3 / secondary:** standard shadcn blocks with real product content and one
  product-specific signature (usually the hero image). Smallest checks that
  cover the changed surface.
- **P4 / parked or exploratory:** shared template or one standard block; keep
  it small and coherent.

Every priority must still pass the applicable design-review gates; Persuade
surfaces must pass the separate 85/100 product-purpose gate. Accurately state
lifecycle and commercial availability, preserve accessible navigation and
focus, avoid responsive overflow, and keep the primary action functional.

## Receipt and quality gate

Record `direction.library.primary` (`shadcn-ui`, or `existing-project-system`
for an owner-granted bespoke product) and the exact component or block URLs in
`direction.library.sources`, with the runtime posture. If a custom pattern was
owner-authorized, record the authorization and reason.

A standard library does not waive Fleet's product-purpose, accessibility,
responsive-browser, performance, or visual-review gates.

Run performance evidence against a production build or production-equivalent
preview. Framework development clients and hot-reload modules are not valid
release-performance evidence.
