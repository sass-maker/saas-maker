## 1. Protocol and registry foundation

- [ ] 1.1 Add bounded repository summary, command candidate, enrollment proposal, catalog approval, and dynamic project source types to the shared protocol
- [ ] 1.2 Add strict parsers and tests that reject mobile filesystem paths, working directories, executables, argv, shell text, and environment values
- [ ] 1.3 Introduce a ProjectRegistry that preserves existing static project behavior while merging validated dynamic entries
- [ ] 1.4 Route snapshot, process, review, agent, and approval lookups through the registry without weakening existing unknown-project rejection

## 2. Low-configuration discovery

- [ ] 2.1 Add repeated local `--root` CLI arguments and equivalent config discoveryRoots with canonical containment checks
- [ ] 2.2 Allow bridge startup with zero projects when valid discovery roots exist and derive safe machine/state defaults for the low-configuration path
- [ ] 2.3 Extend bounded discovery metadata with relative display location, ecosystem, package manager, enrollment state, and stable opaque repository identity
- [ ] 2.4 Expose authenticated discovery requests with result/depth/count bounds and add unauthenticated and path-escape tests

## 3. Command candidates and persistence

- [ ] 3.1 Add Node package-manager/script detection with bounded script-body review strings, operation mapping, source, and risk labels
- [ ] 3.2 Add bridge-owned Codex and Claude Code new/resume agent adapters without exposing executable paths
- [ ] 3.3 Add strict optional repository-manifest parsing and label every custom command as untrusted until enrollment approval
- [ ] 3.4 Add schema-validated owner-only dynamic catalog persistence using atomic replacement and conflict handling with static projects
- [ ] 3.5 Re-canonicalize dynamic repositories and approved-root containment before every process or Git action

## 4. Enrollment approvals

- [ ] 4.1 Generate enrollment proposals from current server-side candidates and fingerprint all relevant repository metadata
- [ ] 4.2 Add expiring one-use enrollment approval with stale repository, metadata, candidate, replay, and expiry rejection tests
- [ ] 4.3 Persist approved dynamic projects without restart and broadcast the refreshed machine snapshot without executing any command
- [ ] 4.4 Add guarded update and idle-only removal flows that never mutate repository content and reject static project changes
- [ ] 4.5 Prove deploy, rollback, destructive Git, and commit retain their existing fresh runtime approvals after enrollment

## 5. Mobile project enrollment

- [ ] 5.1 Add Add Project entry points and authenticated discovery loading, empty, retry, search, and enrolled states
- [ ] 5.2 Add repository detail with detected ecosystem, package manager, exact argv labels, bounded script bodies, source, and risk badges
- [ ] 5.3 Add candidate selection and explicit enrollment approval using opaque candidate IDs only
- [ ] 5.4 Add dynamic project update/removal management with active-process and static-project restrictions
- [ ] 5.5 Add reducer/client/UI tests for discovery, proposal refresh, stale approval, enrollment, reconnect snapshot, update, and removal

## 6. Verification and handoff

- [ ] 6.1 Run formatting, lint, typecheck, all tests, bridge build, web/iOS exports, and strict OpenSpec validation
- [ ] 6.2 Run an end-to-end zero-project smoke test through pair, discover, propose, approve, enroll, start agent/dev, preview detection, stop, restart, and restored catalog
- [ ] 6.3 Verify the enrollment flow visually at iPhone and regular-width iPad dimensions and confirm no arbitrary path/command controls are rendered
- [ ] 6.4 Compile, install, and launch the standalone native app after protocol/UI changes
- [ ] 6.5 Update README and PROJECT_STATUS.md with low-configuration startup, dynamic enrollment, trust boundaries, and validation evidence
- [ ] 6.6 Archive the change only after all scenarios are implemented and directly verified, then commit and push with CI green
