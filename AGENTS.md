# SaaS Maker agent instructions

## Boundary

SaaS Maker owns only:

- the single owner-local portfolio catalog at `catalog/projects.json` and its
  generated, filtered public exports;
- the public product directory;
- the public scored ideas catalog under `/ideas`;
- package documentation;
- @saas-maker/feedback;
- @saas-maker/ai-chat-footer;
- @saas-maker/portfolio-project-strip;
- the feedback API, image upload, project keys, narrow auth, and private inbox.
- public, credential-free reusable workflows, Fleet-owned skills, operator
  scripts, templates, and their capability directory under `tooling/`;
- the launch-destination catalog at `/launchdesk`, rendered natively from the
  checked-in `apps/showcase/src/data/launchdesk.json` snapshot. This is a SaaS
  Maker feature, not a standalone Fleet product. Preserve the dataset's source
  claims and unknown-vs-zero semantics when updating it.
- the funding and accelerator directory at `/funding`, rendered natively from
  the checked-in `apps/showcase/src/data/funding.json` snapshot (one-time
  import, not a live sync). Preserve per-row evidence quality, uncertainty,
  and the assessment-vs-fact distinction; assessments are portfolio judgment,
  not the programs' claims.

SaaS Maker Tooling owns shared schedules, skills, and host automation. Site
Health owns portfolio operations and reads the SaaS Maker catalog through a
generated compatibility view. Drank, PSI
Swarm, Reel Pipeline, CodeVetter, App Health, and Mobile Dev Cockpit remain
independent products or repositories.

Do not add product task systems, marketing queues, analytics dashboards,
observability, App Health, AI gateways, testimonials, waitlists, Droid, or
fleet-control features here. Shared tooling must remain public,
credential-free, provider-bounded, and independently validated.

## Commands

~~~bash
pnpm test
pnpm typecheck
pnpm build:widget
pnpm check:shared-packages
pnpm build:showcase
pnpm build:cockpit
pnpm catalog:check-public
pnpm check:docs
~~~

Use PROJECT_STATUS.md for durable status. Edit classifications only in
`catalog/projects.json`: product records and all 82 repository-review rows live
there. The raw source is private, owner-local and gitignored. Public catalogue
data is projected into checked-in `catalog/generated/public.json`; public SaaS
Maker pages never read private Fleet state at runtime. See `catalog/README.md`.

The public directory labels each entry's curated `technologies` as “Prominent
tools.” When a product's material stack changes, update the canonical
`projects[<id>].presentation.directory.technologies` entry in `catalog/projects.json` and run
`pnpm catalog:sync-public` here in the same task. Never hand-edit the generated
catalog or expand this field into a dependency inventory.

Do not deploy, migrate, publish/deprecate npm packages, change DNS, or archive
repositories without explicit approval.
