## ADDED Requirements

### Requirement: Locally bounded discovery roots

The bridge MUST discover repositories only inside canonical roots supplied locally through bridge startup arguments or configuration and MUST NOT accept discovery roots or arbitrary paths from the mobile protocol.

#### Scenario: Start without static projects

- **WHEN** the bridge starts with at least one valid local discovery root and no static or enrolled projects
- **THEN** it starts successfully, pairs normally, and exposes an empty enrolled-project snapshot plus authenticated discovery capability

#### Scenario: Reject a mobile path

- **WHEN** a mobile discovery or enrollment request includes a filesystem path or working directory
- **THEN** strict protocol validation rejects the request and the bridge reads or executes nothing at that path

#### Scenario: Stay inside a root

- **WHEN** the bridge scans a discovery root
- **THEN** it returns only bounded canonical Git repositories equal to or contained by that root and does not follow symlinked directories

### Requirement: Authenticated repository catalog

The bridge SHALL return bounded safe metadata for repositories under approved roots only to an authenticated app, including name, relative display location, enrollment state, detected ecosystem, package manager, and available proposal status.

#### Scenario: List discovered repositories

- **WHEN** an authenticated app requests repository discovery
- **THEN** the bridge returns at most the configured limit of safe repository summaries without running project commands

#### Scenario: Reject unauthenticated discovery

- **WHEN** an unauthenticated socket requests repository discovery
- **THEN** the bridge rejects the request without returning repository metadata

### Requirement: Bridge-owned command candidates

The bridge MUST derive operation candidates from current bounded repository metadata and bridge-owned agent adapters, and the mobile app MUST reference candidates only by opaque bridge-issued IDs.

#### Scenario: Detect package scripts

- **WHEN** a discovered repository contains a valid package manifest and recognized package-manager metadata
- **THEN** the bridge proposes only recognized operation scripts with the derived argv, bounded script body, source, and risk label available for review

#### Scenario: Detect an installed agent adapter

- **WHEN** a supported coding-agent CLI is available to the bridge
- **THEN** the bridge may propose its built-in new/resume templates by adapter name without exposing the executable path

#### Scenario: Reject mobile argv

- **WHEN** an enrollment request includes shell source, executable, argv, environment values, or command text instead of candidate IDs
- **THEN** strict protocol validation rejects it and no catalog entry is created

### Requirement: Explicit stale-safe enrollment approval

The bridge MUST require a fresh one-use approval before making a discovered repository controllable and MUST bind that approval to the canonical repository, selected candidate IDs, relevant metadata fingerprint, and expiry.

#### Scenario: Review and approve enrollment

- **WHEN** the user approves an unexpired proposal whose repository and metadata still match
- **THEN** the bridge consumes the approval once, persists the selected server-owned command mappings, and broadcasts a snapshot containing the new project

#### Scenario: Repository metadata changes

- **WHEN** a package script or repository manifest changes after proposal creation but before approval
- **THEN** the bridge rejects the stale approval and requires a refreshed proposal showing the new command content

#### Scenario: Replay enrollment approval

- **WHEN** a consumed enrollment approval is submitted again
- **THEN** the bridge rejects it and does not duplicate or alter the project

### Requirement: Owner-only dynamic project persistence

The bridge SHALL store enrolled dynamic projects in a schema-validated owner-only catalog using atomic replacement and SHALL merge them with immutable static configuration on startup.

#### Scenario: Restart after enrollment

- **WHEN** the bridge restarts with a valid dynamic catalog
- **THEN** enrolled projects and approved command mappings are restored without another enrollment or static config edit

#### Scenario: Dynamic catalog is malformed

- **WHEN** persisted dynamic catalog data fails validation
- **THEN** the bridge fails closed for those dynamic entries, exposes no unvalidated command, and retains valid static projects

#### Scenario: Static project conflicts

- **WHEN** a dynamic entry conflicts with a static configured project ID or canonical path
- **THEN** the static project remains authoritative and the conflicting dynamic entry is rejected or ignored with an actionable local error

### Requirement: Guarded project update and removal

The authenticated app SHALL be able to propose updates to candidate selections or remove a dynamic project through explicit approval, while static projects and repository contents remain immutable from that flow.

#### Scenario: Update detected commands

- **WHEN** the user approves a fresh update proposal for a dynamic project
- **THEN** the bridge atomically replaces only its enrolled metadata and bridge-owned command mappings and broadcasts a refreshed snapshot

#### Scenario: Remove an idle dynamic project

- **WHEN** the user approves removal of an idle dynamic project
- **THEN** the bridge removes only the catalog entry and leaves the repository and its files unchanged

#### Scenario: Remove a running project

- **WHEN** any owned process for a dynamic project is active
- **THEN** the bridge rejects removal until the process is stopped

#### Scenario: Modify a static project

- **WHEN** the app attempts to update or remove a static configured project
- **THEN** the bridge rejects the request and directs the user to local configuration

### Requirement: Revalidate before execution

The bridge MUST re-canonicalize a dynamic repository and verify approved-root containment immediately before every project operation or Git action.

#### Scenario: Repository moved outside the root

- **WHEN** an enrolled repository no longer resolves to its enrolled canonical path inside the approved root
- **THEN** the bridge rejects the operation without starting a process or Git command

### Requirement: Preserve runtime approval gates

Enrollment MUST NOT execute a project command and MUST NOT replace the existing fresh approvals required for deployment, rollback, destructive Git, or other guarded operations.

#### Scenario: Enroll a deploy candidate

- **WHEN** a project is enrolled with a detected deploy candidate
- **THEN** no deployment starts and every later deploy request still requires its own current one-use runtime approval
