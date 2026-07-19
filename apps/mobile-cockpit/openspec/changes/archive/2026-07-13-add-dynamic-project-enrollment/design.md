## Context

The bridge already has a bounded, symlink-avoiding Git repository scanner, but it is exposed only as a separate CLI command. The running server loads an immutable array of projects from a local JSON file, and the mobile protocol can reference only those project IDs. This is safe but unnecessarily manual: a developer must discover a repository, copy its canonical path, understand its package manager, and hand-author every argv array before the app can help.

The phone is authenticated, but authentication alone is not a reason to expose a shell. A session credential could be copied from a compromised device, and package scripts themselves can execute arbitrary code. Dynamic setup therefore needs two distinct boundaries: locally chosen discovery roots constrain which repositories may be proposed, and an explicit enrollment review constrains which server-generated commands become reusable operations.

## Goals / Non-Goals

**Goals:**

- Start the bridge for common use with one or more discovery roots and no hand-authored per-project JSON.
- Discover Git repositories and useful project metadata from the running app.
- Generate command candidates on the bridge from bounded, inspectable project metadata and known agent adapters.
- Let the authenticated user explicitly enroll, update, or remove dynamic projects without restarting the bridge.
- Preserve canonical-path containment, argv execution with `shell: false`, one-use approvals, owner-only persistence, and existing static configuration compatibility.
- Make the exact command and relevant package-script source visible before enrollment.

**Non-Goals:**

- A general SSH client, arbitrary terminal, arbitrary phone-supplied command, remote file browser, or unrestricted working-directory picker.
- Sending environment values, secrets, executable paths, shell source, or raw argv from the mobile app.
- Automatically trusting a repository manifest or running a detected script before explicit enrollment.
- Discovering outside locally supplied roots, following symlinked directories, or scanning the entire filesystem by default.
- Editing project source code through the enrollment UI.

## Decisions

### Separate discovery roots from enrolled projects

The bridge accepts repeated `--root <path>` arguments in low-configuration mode and an equivalent `discoveryRoots` array in JSON configuration. Roots are canonicalized locally at startup. Discovery remains bounded by depth, count, skipped directories, and no symlink traversal.

The app may see repositories inside those roots, but discovery alone never makes a repository runnable. An enrolled dynamic project is a separate persisted record containing a canonical repository identity and bridge-owned command candidate IDs.

Alternatives considered:

- **Scan `$HOME` automatically:** convenient but too broad, slow, and surprising.
- **Let the phone browse arbitrary paths:** turns a mobile credential into filesystem discovery authority.
- **Keep only static JSON:** safest mechanically but fails the desired mobile-first setup.

### Provide a zero/low-configuration startup path

`mobile-dev-cockpit-bridge --root ~/Desktop/fleet --tailscale` derives a machine display name, loopback host, default port, bounded TTLs, and an owner-only application-support state directory. A config file remains available for custom networking, limits, static projects, and advanced overrides. The bridge may start with zero enrolled projects when at least one discovery root exists.

This removes per-repository machine setup while preserving the one local choice that cannot safely be inferred: which filesystem roots the paired phone is allowed to discover.

### Generate opaque command candidates on the bridge

A detector reads bounded project metadata and emits candidates with opaque IDs, operation type, human label, source, risk, and a bounded review string. The phone can select candidate IDs only; it cannot send argv or modify a candidate.

Initial adapters:

- Node package manager from the `packageManager` field or lockfile, with candidates derived from explicit `package.json` scripts such as `dev`, `start`, `build`, `test`, `check`, `deploy`, and `rollback`.
- Installed Codex and Claude Code executables through bridge-owned argv templates for new/resume agent sessions.
- Optional `.mobile-dev-cockpit.json` repository manifests parsed with the existing strict argv schema and labeled as custom/untrusted until approved.

For package scripts, the review surface includes both the resulting argv and the bounded script body because `pnpm run deploy` alone hides what will execute. Unknown ecosystems remain discoverable but require a locally authored manifest rather than guessed commands.

### Use an explicit enrollment proposal and one-use approval

The app requests a proposal for a discovered repository and selected candidate IDs. The bridge re-discovers and re-canonicalizes the repository, resolves candidates from current server state, fingerprints the relevant metadata files, and returns a short-lived approval containing exact commands, script bodies, and risk labels.

Approval is one-use and rejected if the repository path, metadata fingerprint, selected candidates, or expiry changed. Resolving it persists the dynamic project and broadcasts a fresh machine snapshot. Static projects cannot be changed from the phone.

Deploy, rollback, and destructive Git operations still require their normal runtime approval after enrollment; enrollment is not permission to execute them immediately.

### Add a mutable ProjectRegistry behind the server

Replace direct reads of `config.projects` with a registry that merges:

- immutable static projects from JSON configuration;
- mutable enrolled projects from the owner-only catalog.

The registry provides lookup, snapshots, enrollment, update, and removal. Removal is rejected while any owned process for the project is active and never deletes repository files or bridge logs unrelated to the catalog entry.

Catalog writes use a validated schema, temporary file plus atomic rename, and owner-only permissions. On malformed persisted data, the bridge fails closed for dynamic entries and retains static projects.

### Preserve path containment at discovery, enrollment, and execution

Every root and repository is canonicalized with `realpath`. A repository is eligible only when it is equal to or strictly contained by an approved discovery root. Symlinked directory entries remain ignored. Before an operation starts, the registry revalidates that the repository still resolves to the enrolled canonical path and remains within its root.

This repeated validation reduces time-of-check/time-of-use risk if directories are moved or replaced after enrollment.

### Keep the mobile enrollment UI declarative

The dashboard adds Add Project. The flow is:

1. request bounded discovery;
2. search/filter repositories and see enrolled state;
3. open a repository proposal;
4. review detected project type, package manager, commands, script bodies, and risk badges;
5. choose bridge-issued candidates and optional validated display/HTTP(S) URL metadata;
6. approve enrollment;
7. receive the normal project snapshot and use existing controls.

There is no terminal text box, path input, executable picker, environment editor, or argv editor in the app.

## Risks / Trade-offs

- [Package scripts can execute arbitrary code] → Show bounded script bodies, require enrollment approval, preserve runtime approval for high-risk operations, and enroll only repositories under locally chosen roots.
- [A compromised phone can enumerate repository names under approved roots] → Require an authenticated session, cap discovery output, return relative display locations rather than unrelated filesystem content, and let the machine owner choose narrow roots.
- [Repository metadata changes between review and approval] → Fingerprint metadata and reject stale proposals before persistence.
- [A directory is replaced after enrollment] → Re-canonicalize and re-check root containment before every operation.
- [Dynamic state corrupts] → Validate on load, write atomically with owner-only permissions, and fail closed for dynamic entries while keeping static configuration usable.
- [Agent executable detection leaks PATH details] → Return only supported adapter names and availability, never executable filesystem paths.
- [Zero-config mode hides important security defaults] → Print roots, loopback bind, state location, pairing expiry, Tailscale URL, and cleanup commands at startup.
- [Protocol surface grows] → Add strict request key validation, response bounds, stale proposal tests, and compatibility tests for existing static clients.

## Migration Plan

1. Add catalog/proposal types and strict protocol parsing without changing existing requests.
2. Introduce the ProjectRegistry behind existing static project lookups and prove no behavior change for static configuration.
3. Add low-configuration roots, detection adapters, owner-only persistence, and enrollment approvals.
4. Add the mobile Add Project and management flows.
5. Run protocol, bridge, state, security, UI, smoke, and native checks.
6. Update documentation to recommend `--root` startup for common use while keeping `--config` for advanced/static setups.

Rollback is starting the previous bridge version with the existing static config. The dynamic catalog is local and can be ignored by older versions; no repository or cloud data is migrated.

## Open Questions

- Additional ecosystem detectors can be added after Node web repositories prove the candidate model; unknown commands should remain explicit manifests rather than heuristic guesses.
- A future locally authenticated desktop settings window could manage discovery roots, but the first version keeps that authority in the startup command/config file.
