## ADDED Requirements

### Requirement: Configured agent sessions

The bridge SHALL start only a project-configured agent command in a pseudoterminal and SHALL associate at most one active agent process with that project.

#### Scenario: Start agent

- **WHEN** the app starts an agent for a project without an active agent
- **THEN** the bridge launches the configured argv command in that repository and streams its output

#### Scenario: Agent is unavailable

- **WHEN** a project has no configured agent command
- **THEN** the bridge reports the capability unavailable without executing a fallback shell command

#### Scenario: Resume configured agent session

- **WHEN** the project declares an agent resume argv and the user chooses Resume
- **THEN** the bridge launches that configured argv in the same pseudoterminal-backed agent slot

### Requirement: Send instructions and stop work

The app SHALL send natural-language instructions to an active agent and SHALL be able to stop the owned agent process.

#### Scenario: Send instruction

- **WHEN** the user submits instruction text while an agent process is running
- **THEN** the bridge writes the text to that process input and streams subsequent output

#### Scenario: Stop agent

- **WHEN** the user requests stop for the active agent
- **THEN** the bridge terminates the owned process and reports that the session stopped

### Requirement: Send preview evidence

The app SHALL let the user capture the visible preview and send a bounded compressed image plus optional note to the active agent.

#### Scenario: Send screenshot to agent

- **WHEN** the user sends a captured preview while an agent is active
- **THEN** the bridge validates and writes the image to its private attachment directory and sends the agent an instruction referencing that exact path

#### Scenario: Reject oversized screenshot

- **WHEN** an attachment exceeds the protocol byte limit or has an unsupported encoding
- **THEN** the bridge rejects it without writing a file or instructing the agent

### Requirement: No arbitrary command channel

The protocol MUST NOT accept shell source, executable paths, working directories, or arbitrary argv values from the mobile app.

#### Scenario: Unsupported command payload

- **WHEN** a client includes arbitrary command fields in an operation request
- **THEN** the bridge ignores or rejects those fields and executes no unconfigured command
