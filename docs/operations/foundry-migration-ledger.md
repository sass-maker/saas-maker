---
title: Foundry source migration ledger
description: Provenance, import boundaries, deploy identities, and rollback references for the Foundry monorepo consolidation.
---

## Purpose

This ledger is the auditable boundary between the former Foundry repositories
and their canonical paths in this monorepo. It records source without treating
source consolidation as deployment approval. No DNS, production deployment,
binding, storage resource, credential, or legacy repository changed during
these imports.

## Imported source

| Component | Source and frozen revision | Canonical path | Import evidence | Existing production identity | Rollback before cutover |
| --- | --- | --- | --- | --- | --- |
| SaaS Maker | `https://github.com/sass-maker/saas-maker.git`, `main` at `516a625` | repository root | consolidation branch starts from the reviewed AI-infrastructure main revision | API `saasmaker-api`; Cockpit `saasmaker-dashboard`; Pages `saas-maker-home`; Droid `saasmaker-droid` | deploy the last known-good component revision from SaaS Maker `main` |
| Mobile Dev Cockpit | `https://github.com/sass-maker/mobile-dev-cockpit.git`, `main` at `228d9bd99048a468ce597ef8a2d0005f06bdd280` | `apps/mobile-cockpit/` | initial unsquashed import `438e066`; latest source sync `aa1119c` | local Apple/Expo control client; no hosted production identity | build or distribute from the recorded standalone source revision |
| Drank | `https://github.com/High-Signal-App/drank.git`, `main` at `e97fa60d417e065209937102857b1f8f579b2fde` | `services/drank/` | initial unsquashed import `a416c50`; latest source sync `a2f1d6c` | Cloudflare Pages project `drank`; `domains.sassmaker.com` | deploy the recorded standalone source revision with its existing `pnpm deploy` path |
| Reel Pipeline | `https://github.com/sass-maker/reel-pipeline.git`, `main` at `fc9c26f37b783d2143d701f03f997aba0998e9cb` | `services/reel-pipeline/` | initial unsquashed import `c07d7dd`; latest source sync `d679e6b`; root submodule paths normalized by `e7c2207` | Worker `reel-pipeline-artifacts`; route `reels.sassmaker.com/*` | deploy the recorded standalone source revision and its Worker config |
| Fleet Ops | `https://github.com/sass-maker/fleet-workspace.git`, Fleet root `main` at `77fbcd911ed33a05fce5f65a3b75a2317fd69000` | `ops/` and `skills/` | initial `fleet-ops/` history split `42f79ce`; latest split `9d6b439` merged by `c4e7f09`; path normalization `c208b0e` | source tooling only; the private Cockpit remains a separate manual production cutover | run the recorded Fleet workspace revision; no production owner is disabled by this import |
| PSI Swarm | `https://github.com/sass-maker/psi-swarm.git`, historical standalone `main` at `3b74ce64aff2116013c9c25968410b9daceb945e` plus Fleet root `main` at `77fbcd911ed33a05fce5f65a3b75a2317fd69000` | `tools/psi-swarm/` | standalone history graft `20dbea3`; current tree comes from the Fleet Ops sync `c4e7f09` and remains normalized under `tools/` | Pages project `psi-swarm-web`; `performance.sassmaker.com` | deploy standalone `3b74ce6` or the recorded Fleet-owned known-good source revision |

The source URLs and revisions remain available in Git history. Old repositories
are not archived or made read-only
by this change; those actions require a separate explicit approval after build,
deploy-identity, live-parity, and rollback checks pass.

## Reel Pipeline submodules

The import preserves these exact gitlinks and keeps their declarations in the
root `.gitmodules` file:

| Path | Frozen gitlink |
| --- | --- |
| `services/reel-pipeline/engines/MoneyPrinterTurbo` | `bf229e20012e38f3bf161679fa98894b1e6f6d63` |
| `services/reel-pipeline/engines/reel-maker` | `cedeeea002566bb81b2dff7b67ef852957fadbaf` |

Submodules are intentionally uninitialized in a fresh clone. Host bootstrap
must report them as prerequisites for Reel work; it must not initialize or
update them implicitly.

## Source-state exclusions

- The frozen Mobile Dev Cockpit source was clean on `main` and had no stash.
- Drank's reviewed dead-code cleanup and latest weekly public DR snapshot are
  included through its recorded pushed `main` revision.
- Reel Pipeline's obsolete OpenShorts adapter and submodule are removed. The
  remaining engine gitlinks stay pinned at the repository root.
- Fleet Ops is synchronized from the clean Fleet root `main` revision recorded
  above. Fleet-owned PSI source remains normalized under `tools/psi-swarm/`;
  it is not duplicated under `ops/`.
- Retired Fleet snapshots remain isolated under `ops/` as historical input.
  They are outside root workspaces, catalog generation, schedules, and public
  projections; retaining them does not reactivate removed products.

## Cutover gates

Each row remains `source imported, production unchanged` until all of the
following are attached to the same component identity:

1. native lint, typecheck, test, build, and documentation checks;
2. path-filter and full-matrix CI parity;
3. dry-run proof that the monorepo command resolves to the existing deploy
   identity, bindings, storage resources, and canonical domain;
4. last-known-good production revision and tested rollback command;
5. bounded live smoke/parity evidence after a separately approved deployment;
6. an explicit decision before the old repository is archived or any old
   schedule is disabled.

The designated operations host is also a separate cutover. Every clone stays
inert until a machine-local role, lease, and explicit activation command are
present.
