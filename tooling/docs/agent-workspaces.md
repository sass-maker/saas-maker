# Agent workspaces

Use `fleet-workspace` for Fleet writer checkouts, dependency installs and heavy
commands. It is a local Node CLI with no dependencies; close can use optional
read-only GitHub evidence through an already authenticated `gh`.
Implementation tracking: [SaaS Maker #179](https://github.com/sass-maker/saas-maker/issues/179); lockfile-only follow-up: [#195](https://github.com/sass-maker/saas-maker/issues/195).

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

For pnpm repositories, the install command requires an exact
`packageManager: pnpm@x.y.z` pin and an existing `pnpm-lock.yaml`. Corepack
selects the repository's pnpm version.
The command supplies `--frozen-lockfile`, the persistent store path and
`--config.modules-cache-max-age=0` (no retained orphan package versions in each
checkout). On macOS it requires `--package-import-method clone`: APFS shares
package blocks through copy-on-write while edits remain isolated. Unsupported
cloning fails rather than silently making full copies. Other platforms default
to pnpm's `auto` imports. `--offline` is optional for a warm store.
Repository lockfiles, package-manager pins, registry/auth configuration and
production settings are not rewritten by this tool. Different store formats
can coexist under a persistent store.

Existing npm repositories use native `npm ci --cache ~/.npm`, with `--offline`
when requested. This path requires a regular, valid existing `package-lock.json`
(version1–3) and an absent or exact `npm@x.y.z` package-manager declaration.
Native npm performs the frozen manifest/lock agreement check; no migration,
lock generation or manager activation is performed. A stale `pnpm-lock.yaml`
does not take precedence over an npm lock in this case. Explicit pnpm pins
always require the pnpm path; an explicit npm pin must match the installed
`npm --version` or installation fails before `npm ci` launches. Malformed or
unknown declarations fail closed. Integrity-suffixed npm pins are not supported
because the installer does not validate their declared integrity.
Yarn/Bun still need separately scoped support or an explicit migration.
The same workspace disk/reserve and heavy-command leases apply to npm installs.
Direct `fleet-workspace run -- npm ci` remains rejected; use `install`.

When a dependency change intentionally requires updating an existing pnpm
lockfile, use `fleet-workspace lockfile-only --id <id>`. This command requires
an active managed writer, regular non-symlink `package.json` and `pnpm-lock.yaml`
files, an exact existing pnpm pin, and separate local `node_modules` layout; it
runs the pinned Corepack pnpm with `install
--lockfile-only --ignore-scripts` and the same persistent store/import defaults
under the existing heavy-command lease and disk limits. It does not install
packages into `node_modules` and cannot bootstrap a missing lockfile. Normal
`install` stays frozen, and generic `run` continues to reject package-manager
install/update commands. After intentional dependency edits, regenerate the
lockfile first, review that diff, then run the ordinary frozen `install`.

For an independently locked child package, use
`fleet-workspace lockfile-only --id <id> --package-dir app`. The child must have
its own regular manifest, exact pnpm pin and lockfile. Absolute paths, traversal,
symlink directories/metadata/dependency layouts and inherited parent pnpm
workspaces are rejected. A child's own regular `pnpm-workspace.yaml` establishes
an independent boundary even inside another workspace. Corepack uses the child's
exact pin and `--dir`, while
the managed command retains the root writer lease, disk budgets and shared store.
Follow with `fleet-workspace install --repo <absolute-worktree>/app`.

Creation checks out source only; dependencies are installed only when a task
explicitly needs them. Do not install for read-only inspection or dependency-free
Node tooling. Configure the existing persistent store once, rather than creating
per-task stores. Store and checkout must be on the same filesystem. Each worktree
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
usage. Disk scans run asynchronously with at most four concurrent measurements.
`status --no-disk` skips every disk measurement and omits budget reporting;
workspace `reportedBytes` is null. `du` figures do not account for shared APFS
blocks or establish physically reclaimable space. Stale heartbeats are a review
signal, never deletion authority.
Long idle tasks should send `heartbeat` manually. PID reuse is handled
conservatively: a live PID may keep an old command lease blocked.

Mutations serialize through an exclusive registry lock. A crashed lock owner
causes a clear error instead of an unsafe automatic takeover. Inspect the PID
in `state.lock`; once the owner is confirmed dead, preserve the lock by renaming
it outside the active path before retrying. A malformed manifest or unknown Git
state fails closed. Failed creation remains recorded for review.

## Completion and existing worktrees

Closing a completed task **deletes its clean, merged checkout by default** with
`git worktree remove`, including recognized generated artifacts. It does not
retain a source copy or add archival Git refs. The owning repository's normal
merged history remains. Small private operation records track the outcome; the workspace manifest is
removed, so completed tasks occupy no writer slots or per-worktree Git/disk scans.
Lifetime task count therefore does not retain lifetime build environments.
Storage still grows with genuinely new Git content, package versions, active
builds, and any protected local data; 10,000 simultaneously populated checkouts
cannot be promised zero storage.

Slow merge and open-file checks run outside the registry lock. Close rechecks
the workspace under a short lock, then reserves filesystem removal with an
ordinary command lease that older Fleet clients also understand. Other agents
can continue working; no incompatible manifest states are introduced.

Close verifies repository/worktree identity, all tracked and untracked changes,
merge evidence, managed command leases, locks, submodules and open files visible
to `lsof`. A pushed feature branch alone is **not** a completed merge. Deletion
requires ancestry in the remote default branch, content-equivalent landed
changes, qualifying merged-PR evidence, or the existing explicit `--landed`
operator attestation. Fetch the owning repository before a cleanup sweep when
remote refs may be stale. No fetch happens implicitly.

Git also deletes ignored files without `--force`, so close separately inventories
ignored paths. Established `node_modules` installs, SwiftPM `.build`, Cargo
`target`, and recognized JavaScript build/cache directories require an owning
package/build manifest. Workspace package dependency links inherit their
installed workspace root. Generated Husky hooks qualify only when their runtime
matches the installed package and wrappers match known generated templates;
custom hooks remain protected. SwiftPM dependency checkouts with local edits or ignored
files stay protected. Unknown ignored data (including local databases, env
files, evidence and unproven directories) blocks deletion. No file contents from
these unknown paths are read or published. Native build/dependency directories
remain separate while tasks are active; do not share mutable build environments.

A branch switch or detached HEAD is allowed only when the current HEAD is clean
and landed. Close skips disk scans. Change directory out of the checkout first.
Open-file visibility follows current OS permissions; access errors are blockers.
Git's locked-tree and submodule protections are never forced. A pending operation
record remains if deletion or subsequent state recording fails; inspect it and
reconcile missing folders rather than repeating a forced deletion.

```sh
fleet-workspace close --id product-issue-123 --dry-run
fleet-workspace close --id product-issue-123
fleet-workspace gc --dry-run
fleet-workspace gc --apply
```

`gc` checks previously retained **closed** worktrees with the same safety rules,
without expensive disk scans. `--apply` deletes eligible trees; `--dry-run`
changes nothing. Active, busy, dirty, unmerged and unknown-data cases stay put.
The default idle threshold is 30 minutes (`--idle-minutes` can override it).
A failure for one workspace does not discard others' evidence or stop the sweep.
Neither close nor gc removes the shared package store or the primary checkout.

Use `close --retain` only when a full recovery environment is deliberately
needed. That explicit mode preserves the old behavior: it accepts clean work
retained in remote refs, writes a restore receipt, and moves the entire checkout
into `retired`. It reclaims no space and still counts toward the disk budget.
Legacy retained receipts continue to work until the checkout is deleted by gc.
Never retain repeated generated builds by default.

### Squash-landed branches and missing folders

A squash merge leaves the branch HEAD outside every remote ref. `close`
accepts it when every path the branch changed since its merge base with
`origin/HEAD` (or `origin/main`) has identical content there; the receipt
records `landing.landedBy: content-equal`. If `main` has since edited those
paths, close also checks merged GitHub PRs for the recorded and current branch.
A PR qualifies only when HEAD equals or is an ancestor of its head commit;
commits ahead of the PR remain blocked. If its merge commit exists locally,
a remote-tracking ref must contain it. No fetch occurs. Receipts record
`landing.landedBy: merged-pr`, PR number and URL. Missing, unauthenticated or
failing `gh` supplies no evidence. Alternatively, verify the landing yourself
and pass `--landed <sha>` naming the landed commit; it must be contained in a
local remote-tracking ref (fetch first) and
is recorded as `operator-verified`. Unlanded local commits stay blocked.

A folder that disappears (trashed, moved by hand, or vanishing while `du` walks
it) is non-fatal: `status` and `gc` report `missing-worktree`, and disk
measurement accepts a total whose only `du` diagnostics are vanished entries.
`reconcile --dry-run` lists non-closed records whose folder is gone;
`reconcile` marks them `missing` so they stop holding writer slots. It only
changes manifests: no folder, branch or Git worktree metadata is deleted, and
closed records with a missing retired folder are reported, not changed. Deletion removes the workspace manifest; missing folders after an interrupted
operation remain protected for reconciliation.

```sh
fleet-workspace close --id product-issue-123 --dry-run --landed <squash-sha>
fleet-workspace reconcile --dry-run
fleet-workspace reconcile
```

`close --all-landed [--dry-run] [--idle-minutes N]` checks active workspaces
individually using the same close rules and receipts. The default idle threshold
is 30 minutes. Only clean, merged trees with no open files or live command lease
and an older heartbeat are deleted; failures keep that tree and do not stop the
others. JSON lists `closed`, `kept` (with blockers/reasons), and counts. Dry-run
reports eligible trees as `would-delete` without changing anything. Add
`--retain` only for intentional full-environment recovery. No force is used.

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

### Disk measurement and registry contention

Managed command admission, periodic checks, and postflight require fresh complete
workspace, active-worktree, and retired-worktree measurements. Retired top-level
entries use at most four concurrent `du -sk` processes, with a 180-second bound
for the whole retired scan and each process. Timed-out processes are killed and
reaped. The retired sum includes its directory inode and can conservatively
overcount hardlinks shared between retired entries. A top-level retired-directory
change during a scan triggers at most two complete retries; continuous churn
fails closed. Overlapping default retired scans in separate CLI processes share one
complete measurement generation with at most four `du` children. A detached,
bounded worker owns that generation, so losing one caller does not cancel other
callers' evidence. Only callers that joined while the generation was active can
consume its result. A later invocation starts a new complete scan, including new
file growth; completed totals are never reused. A dead worker's surviving process
group remains protected until it is confirmed gone, then a later call recovers
automatically. Unknown ownership and failed measurements still fail closed.
Scan coordination adds no approval prompts or configuration requirements.
Retired worktrees remain included. Admission rechecks the current policy, free
space reserve, material workspace identities, and heavy-job limits under the
registry lock before registering its lease. Identity changes during a create or
managed run scan trigger at most two retries (three complete fresh measurement attempts) before
failing closed. Admission remains atomic; every retry remeasures all three
roles outside the lock and rechecks current limits and free reserve under it.
No old byte totals are used. A converging unrelated create/retirement does not
terminate an otherwise valid child; continuous identity churn remains a
conservative failure. Heartbeat timestamp changes do not invalidate the scan. Periodic scans never overlap, and metadata
heartbeats continue while a scan is in flight. A failed measurement reports its
phase and workspace role before stopping the owned command. Cleanup failures
retain the original failure and their separate cause.

Historical command leases remain recorded after a PID is recycled. On Darwin,
heavy-job liveness compares bounded, C-locale UTC process births with lease
registration (allowing a conservative 60 seconds for timestamp precision and
a stalled immediate spawn). Near-time reuse remains unknown and protected,
since historical leases do not record the exact child birth.
A proven later process does not stand in for the original manager or child. A
recycled process group is rejected only with a proven new leader and entirely
new observed membership. Leaderless orphan groups, older original members, and
unknown births/membership/platforms remain protected; this is not lease deletion
or permission to signal unrelated processes.

## Bounded Node storage and automatic maintenance

- `maintain --dry-run` previews close/GC; `maintain --apply` removes eligible clean, merged worktrees idle for 24 hours.
- Dirty, unmerged, active, locked, unknown and unmanaged data stays protected, including generated output when unknown data blocks a whole-tree deletion.
- The shared pnpm store has a separate 20 GiB reported-allocation budget. Installs check it before, every 15 seconds during, and after execution; excess bytes block installation.
- Native pruning runs only above budget. Warm caches stay reusable: PNPM 10 uses hard-link counts, while APFS clones have separate inodes. Pruning those copies forces later downloads.
- Pruning waits for all managed commands and visible external pnpm/Corepack processes to be idle; its leases block new managed commands. Unknown visibility keeps the store.
- The pruning driver defaults to pnpm 10.33.2 with Corepack network disabled. Other store formats count toward the budget but require their own native maintenance.
- `configure --store-gib 20 --package-import-method clone` sets the cache budget and APFS sharing policy without rewriting repository pins or lockfiles.
- `schedule --dry-run` / `schedule --apply` install hourly macOS launchd maintenance from a durable CLI release, with no startup run. Other systems can schedule `maintain --apply`.
- The latest result overwrites private `storage-maintenance.json`; there is no rolling log archive. One previous schedule plist is kept for rollback.
- Disable with `launchctl bootout gui/$(id -u)/com.sarthak.fleet-workspace-maintenance`. Never schedule a CLI inside a disposable writer checkout.
- These are sampled managed limits, not filesystem quotas or a whole-machine cap. Browser/npm caches, native SDKs and Docker are outside the shared-store budget.
