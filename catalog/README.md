# Portfolio catalog

**Edit only `catalog/projects.json`.** This private, owner-local file is the
single source of classification and owner decisions. Its schema version is 2.

## Project structure

Each of the 59 product identities has these sections (optional fields stay absent):

| Section | Meaning |
| --- | --- |
| `id`, `name` | Stable product identity and display name |
| `classification` | Future form, category, kind, family, tier and attention |
| `purpose` | Personal use, money/brand, unmet need and audience |
| `lifecycle` | Activity status, resume condition, priority and scope decision |
| `sharing` | Shareability decision and retained readiness evidence |
| `ownerNotes` | Exact original notes and owner narrative, without paraphrasing |
| `repositories` | Local/source paths, repository URL, visibility and aliases |
| `deployment` | Deployment status, domains, authentication, targets and database dependencies |
| `presentation` | Public listing metadata and directory details, including the original maker note |
| `retainedFields` | Any unmapped fields, retained verbatim rather than discarded |

`classification.futureForm` is the owner classification.
`sharing.shareable` is the authoritative owner shareability decision. Primary and
active projects are shareable; inactive projects may also be shareable. Readiness
evidence stays separate and is not rewritten by this classification rule.
`lifecycle.status` is the primary/active/inactive lifecycle.
`deployment.status` describes operational state. The older
`lifecycle.portfolioStatus` and `sharing.readyToBeShared` remain evidence from the
previous schema; they do not override those authoritative decisions. This
migration preserves differing values; it does not invent resolutions.

Top-level `repositoryReview.repositories` retains all 82 original repository
entries. Linked rows inherit their product classification; standalone rows retain
their own classification. 82 repositories are not 82 distinct products.

Top-level `infrastructure`, `geoIdentities`, `_meta` and all unknown fields are
preserved. Infrastructure dependencies and evidence have not been removed.
`publicDirectory` retains export metadata and any unmatched entries; matched
project metadata now lives in `presentation.directory`.

## Generated views

Run after editing:

```sh
pnpm catalog:sync
pnpm --dir ../site-health docs:projects
```

- `generated/public.json`: allowlisted public export. Only explicitly shareable,
  non-hidden projects appear; inactive shareable experiments may still appear.
- `generated/repository-classifications.md`: complete 82-repository review table.
- `generated/operations.json`: private, generated compatibility view for existing
  tools. Site Health's `apps/backend/config/projects.json` links here. Never edit
  either path. It is a disposable output, not a classification source.

The public website and GitHub profile consume the hosted filtered export at
`https://sassmaker.com/portfolio.json`. Public builds do not read the raw catalog.
Raw source, operations output and migration backups are gitignored; a new private
operational checkout needs the owner-provided source file.

## Preservation and checks

`scripts/catalog-schema.mjs` defines a reversible field mapping. Unknown fields,
missing values, nulls, empty values and exact strings are preserved. Source checks
reject fields that would be silently lost during compatibility generation.

```sh
pnpm catalog:test-schema
pnpm catalog:check-source
pnpm catalog:check-operations
pnpm catalog:check-public
pnpm catalog:check-table
```

The September 12 migration has a byte-for-byte pre-migration snapshot and SHA-256
receipt under `.fleet-local/catalog-backups/`. Its inverse transformation matched
every original value, and its public output matched the old output exactly.
Backups are recovery snapshots, never consumer inputs. Keep this directory and
the source in the owner's local backup.

Historical owner narratives are an immutable archive, not editable classifications.
The mapping is documented in `field-map.md`.
