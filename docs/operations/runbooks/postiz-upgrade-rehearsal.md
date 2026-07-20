---
title: Postiz upgrade rehearsal
---

## Purpose

Use this procedure before changing the pinned Postiz image or any PostgreSQL,
Redis, Temporal, or Elasticsearch tag. An upgrade is not a deployment approval;
the checked-in stack and schedules remain inert until a separate cutover.

## Source and fixture checks

1. Review the official release notes, migration guidance, multi-architecture
   package digest, and upstream compose topology for the candidate release.
2. Update `ops/host/postiz/images.json` and `compose.yaml` together. Never use
   `latest`; pin the Postiz tag plus multi-architecture digest and pin every
   dependency tag.
3. Run the focused static and disposable-state tests:

   ```sh
   node --test ops/test/postiz-host.test.mjs
   pnpm host:test
   ```

4. Run the disposable backup/candidate/rollback procedure from
   [`postiz-backup-restore.md`](postiz-backup-restore.md). This proves the
   mechanics without Docker or network access; it does not prove the candidate
   container migration.

## Isolated candidate rehearsal (separate approval required)

1. Complete a verified real backup using the backup/restore runbook.
2. Restore that backup into a new machine-local candidate data root. Keep the
   active root untouched.
3. Render Compose configuration with machine-local placeholder files and
   inspect the result. Refuse any public port, unpinned image, checkout-local
   state path, or embedded env/secret value.
4. Start the candidate only with the explicit `postiz-manual` profile on the
   private host. Confirm `127.0.0.1:4007` and `127.0.0.1:7233` are the only
   published bindings.
5. Verify all container health checks, Postiz health, auth-gated API
   compatibility, private reachability, database state, uploads, Temporal
   workflows, and a draft-only fake/test flow. Do not connect or publish to a
   real social channel.
6. Stop the candidate. Restore the same backup into a second empty rollback
   root using the previously pinned image set, then repeat the health and data
   checks.
7. Record sanitized candidate and rollback receipts. Attach the release,
   digest, timestamps, checksum result, health/API result, and rollback result;
   exclude credentials, env values, paths, hostnames, and account payloads.

## Promotion gate

Promote an upgrade only after the owner separately approves the exact release,
digest, host, backup retention, maintenance window, and rollback evidence.
Schedules remain disabled until that approval and a healthy shared host lease.
On any ambiguous migration, API drift, failed restore, or public exposure,
leave the existing version unchanged and keep distribution queued.
