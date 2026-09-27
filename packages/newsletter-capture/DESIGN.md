# Newsletter and Waitlist Capture design

## Approved direction: 02 — Direct line

Owner selected direction 02, Direct line. It is a compact, precise footer form
with calm host-aware surfaces and a distinct green success/status signal. It
sits beside the existing AI Chat Footer and Portfolio Project Strip; feedback
remains a separate hover button where appropriate.

## Hierarchy

1. A short product-branded heading and one sentence explain what messages are
   offered.
2. Email and capture kind are the main controls, followed by required consent.
3. One direct action submits the request. Inline loading, success, and error
   states stay close to the form.

## Layout and tokens

- Use one quiet, bounded footer region with a fine top rule and inherited host
  typography. Do not create a promotional card or another large footer panel.
- At wide widths, keep email, kind, and submit controls on one line; keep the
  consent sentence directly beneath. Stack controls as space narrows.
- Expose semantic text, muted, border, surface, focus, action, success, and error
  CSS properties so products can brand the component without changing markup.
- The success treatment uses a calm green text and border. Error remains distinct
  and never relies on color alone.

## Interaction and accessibility

- Use native email, select, checkbox, and submit controls with associated labels.
- Leave consent unchecked by default. Update the consent sentence when kind
  changes and include an optional privacy link.
- Keep form controls and the whole consent-label tap area at least 44px high;
  keep the checkbox visually compact. Expose visible focus and announce loading,
  success, and errors through a polite status region.
- Respect reduced-motion preferences; motion is limited to short state changes.

## Source pattern

Reuse the browser custom-element packaging and host-aware footer conventions in
SaaS Maker's AI Chat Footer and Portfolio Project Strip. The owner explicitly
authorized a new capture pattern because those packages do not provide a
consented email form. Do not add an upstream runtime library or paid source.
