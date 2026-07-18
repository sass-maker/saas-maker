# Hand-written JSON-LD

**Tried:** Hand-writing the `<script type="application/ld+json">` block in
`app/layout.tsx`.

**Why it seemed good:** Small, fixed structured-data payload; simplest
possible approach.

**Why it failed:**

- Hand-written JSON-LD drifts from the fleet-wide organization/application
  registry and is easy to get subtly wrong.
- The fleet has a generated marked-block convention (`fleet-jsonld:start`/
  `end`) that keeps JSON-LD in sync with the registry.

**What we do instead:** Replaced the hand-written block with the
fleet-generated marked block (still in `app/layout.tsx`, between
`fleet-jsonld:start` and `fleet-jsonld:end` comments). Edit the registry,
not the layout.

**Commit:** `bedd31f` (replace hand-written JSON-LD with fleet-generated
marked block).
