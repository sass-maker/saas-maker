# Cockpit design

The private product scoreboard uses the owner's selected **Portfolio sheet**
direction (23 October2026). Product meaning and cadence live in
[`docs/product-scoreboard.md`](../../docs/product-scoreboard.md).

- Use the existing app shell, sidebar/mobile navigation, shared PageHeader,
  Geist typography, components and theme tokens. The scoreboard is part of the
  same product workspace as feedback, subscribers and project keys; it has no
  alternate navigation shell or fixed light palette. Respect the active theme.
- Use the available content width. Table layouts respond to their container,
  including the shared sidebar. No table owns a horizontal or vertical scroll
  area; narrower content reflows to paired score cards.
- Group each of the six categories over separate Effort and Result columns.
  Each leaf header sorts its own visible number and reverses on every click.
  Totals sort known displayed points, including partial totals. Unknowns stay
  unknown; exemptions keep their reduced denominators.
- Keep numbers readable and labels in the header, rather than repeating long
  labels in every desktop cell. Scores use plain numbers without decorative
  bars. Purpose labels appear once; priority uses Focus or Standard.
- Tablet and phone layouts use labelled product cards. Each category still
  pairs its own two readings. Provide explicit sort and direction controls.
- Open evidence for the reading selected, with the other reading one click
  away. Keep its next lever reachable from the same category. History, cadence,
  imports, exports and all saved data retain their meaning.
- Project feedback pages link directly to the scoreboard filtered to their
  project name. Preserve existing project identities, keys and inbox routes.
- The private surface remains authenticated and excludes replay scripts. Shared
  navigation uses full page transitions at that privacy boundary.
