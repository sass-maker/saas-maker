---
title: Postiz backup and restore
---

## Purpose

Use this procedure to prove that the machine-local Postiz state can be backed
up and restored before any host activation. It covers Postiz `v2.21.10`, its
PostgreSQL 17 database, Redis 7.2 state, uploads/config, and the Temporal
PostgreSQL 16 and Elasticsearch 7.17.27 stores.

This runbook does not authorize starting Docker, enabling schedules, connecting
accounts, or changing production. Keep every env file, dump, archive, and
receipt outside the checkout.

## Disposable source-only rehearsal

Create an empty disposable directory and run the filesystem rehearsal. It
creates fake state for all six persistent paths, snapshots it, verifies a
candidate restore, mutates only the candidate copy, and verifies rollback from
the unchanged snapshot. It never launches Docker or contacts a network.

```sh
POSTIZ_REHEARSAL_ROOT=$(mktemp -d "${TMPDIR:-/tmp}/postiz-rehearsal.XXXXXX")
node ops/host/postiz/rehearsal.mjs --root "$POSTIZ_REHEARSAL_ROOT"
```

Inspect `restore-rehearsal-receipt.json` in that disposable directory. A pass
reports `result: verified`, `sourceRelease: v2.21.10`, six state directories,
and six fixture files. Move the directory to Trash after review; do not reuse a
fixture receipt for host activation evidence.

## Real backup gate (owner-approved host only)

1. Confirm `node ops/host/hostctl.mjs doctor --role-file <role-file>` passes and
   the role points to the intended private host and machine-local data root.
2. Pause queued distribution and evidence synchronization at their external
   scheduler. The checked-in definitions are already disabled and must remain
   disabled during this source-only phase.
3. Record the current `ops/host/postiz/images.json` release and digest. Confirm
   the running image matches before taking a backup.
4. Use the operator-owned compose invocation and machine-local env files to
   create consistent logical dumps for both PostgreSQL services. Capture Redis
   after a successful persistence operation. Snapshot `postiz-config`,
   `postiz-uploads`, both database data roots, Redis, and Temporal Elasticsearch
   into a new timestamped backup directory.
5. Write checksums for every dump/archive next to the backup. The backup must
   contain no env file, API key, OAuth material, or plaintext command output
   with credentials.
6. Restore into a separate, empty machine-local rehearsal root. Never restore
   over the active data root.
7. Start only an isolated, localhost-bound rehearsal stack after separate
   approval. Verify database consistency, Redis readability, uploads, Temporal
   health, Postiz health, and the auth-gated public API route.
8. Stop the rehearsal stack and record a sanitized receipt with release,
   verification time, checksum result, backup identifier, and restore result.
   Do not include paths, hostnames, account names, tokens, or env values.

## Failure and rollback

- Any missing dump, checksum mismatch, unreadable upload, unhealthy dependency,
  public binding, or API `404` fails the rehearsal.
- Keep the active stack paused. Do not retry publication through Reel Pipeline.
- Preserve the failed rehearsal directory and sanitized logs for diagnosis.
- Restore only from the last independently verified backup, into an empty data
  root, after explicit owner approval.
