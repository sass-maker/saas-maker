---
name: project-register
description: Register a Fleet project in the canonical portfolio — catalog/projects.json record, generated views, Site Health dossier, public directory metadata, and entity-identity record. Use when a new project needs its saas-maker entry, a project is missing from the catalog or dossiers, or launch readiness fails on registration checks.
---

# project-register — canonical portfolio registration

Phase 2 of `docs/new-project-checklist.md`. A project is not registered until
all five records exist and agree; run `project-readiness --project <id>` to
verify the `register` section.

## Records to produce

1. **`catalog/projects.json` entry** (saas-maker, private/owner-local) —
   the single classification source. Required sections: `id`, `name`,
   `classification`, `purpose`, `lifecycle`, `sharing`, `repositories`
   (localPath, visibility, repository URL), `deployment` (status, domains,
   targets), `presentation`. Read two neighboring entries and match their
   shape exactly — the schema is enforced by `pnpm catalog:check-source`,
   not written down separately.

   Classification (`futureForm`, `shareable`, lifecycle status) is an **owner
   decision** — draft the record, show the diff, get confirmation before
   committing the judgment calls. Mechanics can be filled freely.

2. **Generated views** — from `saas-maker/`:

   ```bash
   pnpm catalog:sync                 # operations.json + public.json + table + checks
   pnpm --dir ../site-health docs:projects   # regenerates docs/project-dossiers/<id>.yaml
   pnpm --dir ../site-health docs:projects:check
   ```

3. **Public directory metadata** — `presentation.directory` carries the
   public listing fields (tagline/description, `technologies`). Keep
   `technologies` to the few tools that materially explain the build — it
   renders as "Prominent tools", not a dependency inventory. Then
   `pnpm catalog:sync-public` so `catalog/generated/public.json` picks it up.
   Skip if `sharing.shareable` is false — a private project still gets the
   catalog entry, just not the public listing.

4. **Entity-identity record** — the name-agreement check needs a canonical
   record before the product ships agent surfaces:
   - `geoIdentities[]` in the catalog (applied form: `id`, `name`,
     `aliases`, `description`, `origin`), or
   - a `decisions[]` entry in `tooling/config/entity-identity-canonical.json`
     when a name was explicitly chosen/renamed (record the reason).
   See `tooling/docs/agent-indexing-standard.md` → Name agreement for what
   each field must agree with later (`llms.txt`, `/api/ai`, JSON-LD, title).

5. **Search Console collection** — if the project has a domain, Site
   Health's `search-console-collect` picks it up only when the property is
   registered. Registration is a provider action — flag it to the owner,
   don't improvise.

## Verify

```bash
node tooling/scripts/project-readiness.mjs --project <id>
# register section should show: catalog.entry, catalog.directory (or skip),
# identity.record, dossier.exists — all pass
```

## Hard rules

- Edit only `catalog/projects.json`; never hand-edit `catalog/generated/*` or
  Site Health's `apps/backend/config/projects.json` symlink target.
- Do not commit the raw catalog diff publicly — it is owner-local and
  gitignored; only the generated allowlisted exports are public.
- `ownerNotes`/verbatim fields are never paraphrased; copy them byte-exact if
  they apply.
