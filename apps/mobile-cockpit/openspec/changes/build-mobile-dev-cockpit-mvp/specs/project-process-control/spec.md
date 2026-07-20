## ADDED Requirements

### Requirement: Explicit project allowlist

The bridge MUST expose and operate only on projects declared in its configuration, with repository paths resolved to absolute canonical directories.

#### Scenario: List projects

- **WHEN** an authenticated app requests the project list
- **THEN** the bridge returns only configured projects and their safe metadata, URLs, and process status

#### Scenario: Reject unknown project

- **WHEN** a request names a project that is not configured
- **THEN** the bridge rejects it without reading a path or starting a process

### Requirement: Read-only repository discovery

The bridge CLI SHALL discover Git repository roots under explicitly supplied search roots without making a repository controllable until it is added to configuration.

#### Scenario: Discover candidate repositories

- **WHEN** the user runs discovery for an existing directory
- **THEN** the CLI returns bounded canonical repository paths and does not execute a project command

### Requirement: Configured process lifecycle

The bridge SHALL start, stream, and stop configured development, build, and test commands using argv execution in the configured repository directory.

#### Scenario: Start development server

- **WHEN** the app starts the configured development operation for an idle project
- **THEN** the bridge starts one child process, streams stdout and stderr, and reports running status

#### Scenario: Stop active operation

- **WHEN** the app requests stop for an active project operation
- **THEN** the bridge terminates the complete owned process group, escalates after a bounded grace period if necessary, and reports the final status

#### Scenario: Run configured build

- **WHEN** the app starts the configured build operation
- **THEN** the bridge runs the declared build argv in the configured repository and streams its result

### Requirement: State recovery

The bridge SHALL provide a complete current snapshot after an authenticated reconnect.

#### Scenario: Resume after network interruption

- **WHEN** the app reconnects while a managed process is still running
- **THEN** the app receives the process status and recent buffered log lines without restarting the process

### Requirement: Development preview detection

The bridge SHALL detect HTTP(S) preview URLs printed by a development process and SHALL rewrite loopback hostnames to an explicitly configured advertised host when present.

#### Scenario: Development server reports a port

- **WHEN** development output contains a local HTTP URL with a port
- **THEN** the bridge publishes a phone-reachable project preview URL in the next snapshot

#### Scenario: Start configured secure preview

- **WHEN** a project declares a tunnel argv and the app starts the secure preview operation
- **THEN** the bridge runs only that configured command, detects the HTTP(S) URL it prints, and publishes the URL without managing provider credentials
