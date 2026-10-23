# Cockpit design

The private product scoreboard uses the owner's selected **Portfolio sheet**
direction (23 October2026). Product meaning and cadence live in
[`docs/product-scoreboard.md`](../../docs/product-scoreboard.md).

- Keep the dark SaaS Maker navigation, S mark, Geist typography and copper
  actions shared with the public product. The analytical work surface is light:
  background `#f4f4f0`, white rows, text `#272d27`, borders `#d5dbce`.
- Use the full page width. No sidebar compresses the comparison, and no table
  owns a horizontal or vertical scroll area.
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
- Other inbox/project-key surfaces retain their established appearance.
  The private surface remains authenticated and excludes replay scripts.
