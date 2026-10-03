# Agent workspaces

Use `fleet-workspace` for Fleet writer checkouts, dependency installs and heavy
commands. It is a local Node CLI with no dependencies or provider access.
Implementation tracking: [SaaS Maker #179](https://github.com/sass-maker/saas-maker/issues/179).

Review-only agents inspect existing source. Create a linked Git worktree only
when a task needs independent writes. This shares Git objects and keeps the
primary checkout's local changes intact. Pick the base explicitly: `HEAD`
uses committed local source; `origin/main` uses the last fetched remote ref.
Creation never fetches or copies a dirty checkout's uncommitted changes.

```sh
fleet-workspace create --id product-issue-123 --repo /path/to/product \
  --owner codex-task-123 --task 'Fix issue 123' --base origin/main
fleet-workspace install --id product-issue-123
fleet-workspace run --id product-issue-123 -- pnpm run build
fleet-workspace heartbeat --id product-issue-123
fleet-workspace close --id product-issue-123 --dry-run
fleet-workspace close --id product-issue-123
fleet-workspace gc --dry-run
```

To install or run checks in an existing checkout without creating another one:

```sh
fleet-workspace install --repo /path/to/product
fleet-workspace run --repo /path/to/product -- pnpm run test
```

## Dependencies

The install command requires an exact `packageManager: pnpm@x.y.z` pin and an
existing `pnpm-lock.yaml`. Corepack selects the repository's pnpm version.
The command supplies `--frozen-lockfile`, the persistent store path and
`--package-import-method auto`; `--offline` is optional for a warm store.
Repository lockfiles, package-manager pins, registry/auth configuration and
production settings are not rewritten by this tool. Different store formats
can coexist under a persistent store. Existing npm/Yarn/Bun repositories need
an explicitly scoped migration before using this installer.

Configure the existing persistent store once, rather than creating per-task
stores. Store and checkout must be on the same filesystem. Each worktree
retains its own dependency graph, binaries and generated files. pnpm shares
package contents through copy-on-write clones or hardlinks; sharing one mutable
`node_modules` directory across writers is not supported.

```sh
fleet-workspace configure --store-dir /absolute/persistent/pnpm/store
```

CLI store flags override ambient configuration. Child commands also receive
the same store/import defaults for subprocess installs. Generic `run` rejects
direct package-manager install/add/update commands; use the dedicated installer.
This is cooperative agent tooling, not an OS sandbox: arbitrary shell commands
can bypass it. Fleet instructions require agents to use it.

## Limits and state

Private manifests and receipts live outside repositories, by default under
`~/Library/Application Support/Fleet/Agent Workspaces.noindex`. Never commit or
publish this state. `--root` or `FLEET_AGENT_STATE_DIR` overrides the location.

Default limits are eight open writers, two heavy commands, 8 GiB per checkout,
40 GiB across managed active and retired worktrees, and 20 GiB free-space reserve.
Installs count as heavy commands. `run` refuses a second managed command in the
same checkout. Commands retain PID/process-group leases and refresh workspace
heartbeats every 15 seconds. Disk budgets are checked before, after and during
commands (every 15 seconds); exceeding a limit sends SIGTERM to the command's
process group and reports failure. These are sampled limits, not filesystem
quotas; a fast write can temporarily exceed them.

```sh
fleet-workspace configure --max-writers 8 --max-heavy-jobs 2 \
  --workspace-gib 8 --total-gib 40 --min-free-gib 20
fleet-workspace status
```

`status` reports owner, task, branch, heartbeat, Git blockers and reported disk
usage. `du` figures do not account for shared APFS blocks or establish physically
reclaimable space. Stale heartbeats are a review signal, never deletion authority.
Long idle tasks should send `heartbeat` manually. PID reuse is handled
conservatively: a live PID may keep an old command lease blocked.

Mutations serialize through an exclusive registry lock. A crashed lock owner
causes a clear error instead of an unsafe automatic takeover. Inspect the PID
in `state.lock`; once the owner is confirmed dead, preserve the lock by renaming
it outside the active path before retrying. A malformed manifest or unknown Git
state fails closed. Failed creation remains recorded for review.

## Retirement and existing temporary files

Closing checks the linked worktree/repository identity, recorded branch, all
tracked/untracked changes, command leases, and open files visible to `lsof`.
The HEAD must be contained in a local remote-tracking ref. This is local Git
evidence, not a fresh provider check. Open-file visibility follows current OS
permissions; permission errors are blockers. Change directory out of a worktree
before closing it. Locked trees and submodule worktrees remain protected by Git.

A safe close writes a recovery receipt and uses `git worktree move` to relocate
the entire tree to `retired`. Source, branches, ignored output and unknown files
are preserved. Receipts contain the exact recovery arguments. Relocation does
not reclaim physical space, and retired trees still count toward the total
budget so recovery storage cannot grow invisibly. `gc --dry-run` reports them
for review; there is no apply/delete mode. Use the receipt's restore command if
needed; the closed manifest remains historical evidence, so a restored checkout
is treated as unmanaged until explicitly reconciled.

```sh
fleet-workspace inventory --path /private/tmp
```

Legacy inventory discovers linked/independent checkouts and named pnpm stores,
without following symlinks or descending into dependency/build directories.
It reads at most three directory levels (and refuses more than 5,000 queued or
identified entries). Ownership is explicitly unknown. It never adopts, moves,
prunes or deletes existing temporary folders. Check source, unpublished commits,
active processes and required evidence before any separately authorized cleanup.
Keep durable artifacts in their owning project's established evidence location;
avoid retaining repeated generated builds as permanent recovery archives.
