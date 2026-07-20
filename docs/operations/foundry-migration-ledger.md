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
| Mobile Dev Cockpit | `https://github.com/sass-maker/mobile-dev-cockpit.git`, `main` at `3224f6662580fbff11023214fc19cc30d7450623` | `apps/mobile-cockpit/` | unsquashed subtree import `438e066`; second parent is the frozen source revision | local Apple/Expo control client; no hosted production identity | build or distribute from the frozen source repository revision |
| Drank | `https://github.com/High-Signal-App/drank.git`, `main` at `f0c347c58e6cd731bf583545774c19959f24d57a` | `services/drank/` | unsquashed subtree import `a416c50`; second parent is the frozen source revision | Cloudflare Pages project `drank`; `domains.sassmaker.com` | deploy the frozen source revision with its existing `pnpm deploy` path |
| Reel Pipeline | `https://github.com/sass-maker/reel-pipeline.git`, `main` at `e61f8d37e645af5d6a6435cd6926f5a57d1de1c1` | `services/reel-pipeline/` | unsquashed subtree import `c07d7dd`; root submodule paths normalized by `e7c2207` | Worker `reel-pipeline-artifacts`; route `reels.sassmaker.com/*` | deploy the frozen source revision and its recorded Worker config |
| Fleet Ops | `https://github.com/sass-maker/fleet-workspace.git`, `main` at `fb41554` | `ops/` and `skills/` | `fleet-ops/` history split at `42f79ce2b4d0cf43867f05021c25d96c2d343531`; unsquashed import `2c69354`; path normalization `c208b0e` | source tooling only; the private Cockpit remains a separate manual production cutover | run the frozen Fleet workspace revision; no production owner is disabled by this import |
| PSI Swarm | `https://github.com/sass-maker/psi-swarm.git`, `main` at `3b74ce64aff2116013c9c25968410b9daceb945e` plus the newer Fleet Ops snapshot at `fb41554` | `tools/psi-swarm/` | standalone history graft `20dbea3`; current tree comes from the Fleet Ops import; normalized by `c208b0e` | Pages project `psi-swarm-web`; `performance.sassmaker.com` | deploy standalone `3b74ce6` or the prior Fleet-owned known-good source revision |

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
| `services/reel-pipeline/engines/openshorts` | `fe87af6dd599b854e6eab2de0ca247ebafe13885` |
| `services/reel-pipeline/engines/reel-maker` | `cedeeea002566bb81b2dff7b67ef852957fadbaf` |

Submodules are intentionally uninitialized in a fresh clone. Host bootstrap
must report them as prerequisites for Reel work; it must not initialize or
update them implicitly.

## Source-state exclusions

- The frozen Mobile Dev Cockpit source was clean on `main` and had no stash.
- Drank was imported from its pushed `main` revision. A later local
  `chore/knip-dead-code-cleanup` worktree contains uncommitted dependency and
  dead-code experiments; those files were deliberately excluded and remain
  owned by that separate worktree.
- Reel Pipeline was imported from pushed `main`. A locally initialized
  `engines/openshorts` checkout was dirty relative to its gitlink; no nested
  checkout content entered the monorepo.
- Fleet Ops was imported from the clean control-plane worktree at `fb41554`,
  not from the concurrently dirty Fleet checkout. Two untracked tooling-standard
  drafts in the latter were excluded.
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
