## Why

Requiring a developer to hand-author every repository path and command in `config.local.json` undermines a mobile cockpit that already has an authenticated connection to the machine. The app should discover and enroll projects dynamically, while preserving the boundary that a phone session cannot become an arbitrary remote shell.

## What Changes

- Add a zero/low-configuration bridge startup mode that accepts one or more local discovery roots and stores its generated project catalog in the owner-only bridge state directory.
- Expose bounded repository discovery to the authenticated app, including safe metadata such as repository name, relative location, detected package manager, frameworks, package scripts, and enrollment state.
- Detect server-owned command candidates from known package scripts, lockfiles, installed agent CLIs, and an optional repository manifest; never accept executable paths, shell source, working directories, environment values, or argv directly from the phone.
- Add an Add Project flow that lets the user inspect detected commands, choose only bridge-issued candidate IDs, review risk labels, and explicitly approve enrollment.
- Persist enrolled projects and approved command mappings without requiring a bridge restart, and support guarded update/removal without deleting repository content.
- Keep deployment, rollback, destructive Git, and custom manifest commands behind their existing runtime approvals even after enrollment.
- Allow the CLI discovery-root mode to start with zero enrolled projects, so the complete project setup can happen from the paired app.
- Add protocol, catalog, persistence, path-containment, command-detection, enrollment-approval, and mobile state tests.

## Capabilities

### New Capabilities

- `dynamic-project-enrollment`: Authenticated repository discovery, server-generated command candidates, explicit project enrollment, owner-only persistence, and guarded catalog updates without arbitrary mobile command input.

### Modified Capabilities

None. This capability extends the original static allowlist contract with an enrollment path; already enrolled projects and static configuration continue to work.

## Impact

- The shared protocol gains discovery, proposal, enrollment, update, and removal requests plus project-catalog response types.
- The bridge gains a mutable project registry layered over static configuration, a command detector, owner-only catalog persistence, and a `--root` startup path.
- The mobile dashboard gains Add Project, repository discovery, command review, enrollment confirmation, and enrolled-project management surfaces.
- Existing `config.local.json` files remain supported. Static projects stay authoritative unless the user explicitly adopts the dynamic catalog.
- The bridge still executes argv arrays with `shell: false`; no general terminal, arbitrary command field, or phone-supplied working directory is introduced.
