# SaaS Maker Project Status

## Why / What

SaaS Maker is the public product directory and the small shared feedback layer
used by selected products. It exists to make the portfolio discoverable and to
provide one consistent way to collect and review customer feedback.

It is not the Fleet control plane. Fleet Workspace is the single source of truth
for internal project metadata, marketing automation, schedules, skills, Drank,
Reel Pipeline, PSI Swarm, Mobile Dev Cockpit, and common infrastructure.
CodeVetter and App Health remain independent.

## Dependencies

- Fleet Workspace's allowlisted fleet-ops/public/products.json, synchronized
  into catalog/generated/public.json before a directory release.
- Cloudflare Workers, D1, and R2 for the feedback API and image uploads.
- better-auth for the private inbox.
- Blume for package documentation.
- React as the peer runtime for @saas-maker/feedback.

## Timeline

- **2026-07-21 — Production cutover authorized:** The narrowed source, four
  canonical Cloudflare targets, and manual deploy commands are the approved
  production state. Every deploy remains gated on clean, synchronized `main`,
  green CI for the exact commit, and live smoke verification of all surfaces.
- **2026-07-21 — Narrow-source cleanup completed locally:** Removed duplicated
  Fleet services, operational Cockpit pillars, non-feedback API routes, Droid,
  App Health copies, SDK/CLI, retired widgets, skills, host automation, and stale
  planning/docs source. The private Cockpit now contains only feedback and
  project-key surfaces. No production migration, deploy, DNS change, npm action,
  or repository archival was performed. Historical database tables remain
  untouched for a safe cutover.
- **2026-07-20 — Fleet Workspace boundary established:** Imported and reconciled
  Fleet Ops, Reel Pipeline, Content Factory, Drank, Mobile Dev Cockpit, PSI
  Swarm, registries, marketing operations, and host automation into
  sass-maker/fleet-workspace with component-native checks.

## Products

| Surface | Purpose |
| --- | --- |
| sassmaker.com | Public product directory |
| packages.sassmaker.com | Feedback package documentation |
| api.sassmaker.com | Feedback and project-key API |
| app.sassmaker.com | Private feedback inbox |
| @saas-maker/feedback | Maintained public runtime package |

## Features (shipped)

- Deterministic 19-product public projection consumed without private Fleet
  runtime access.
- Feedback submission for bug, feature, and general feedback.
- Optional screenshots and page-element anchoring.
- Public feedback boards and authenticated voting.
- Private cross-product feedback inbox with status and deletion controls.
- Project-key creation and management.
- Blume package docs plus agent/search surfaces.

## Todo / Planned / Deferred / Blocked

### Planned

- Keep the API, Cockpit, directory, and package docs green through the shared
  post-deploy smoke gate.
- Decide separately whether historical npm packages should be deprecated; this
  cleanup does not change npm registry state.

### Deferred

- Dropping retired D1 tables. Source cleanup intentionally avoids a data
  migration.
- Archiving standalone rollback repositories until Fleet Workspace is verified
  on its designated host.

### Blocked

- None.
