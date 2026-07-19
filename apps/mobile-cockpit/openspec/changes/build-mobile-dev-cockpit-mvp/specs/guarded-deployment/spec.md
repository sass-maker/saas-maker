## ADDED Requirements

### Requirement: Fresh approval for deployment

The bridge MUST require a fresh explicit approval for every configured deploy or rollback operation before starting its process.

#### Scenario: Approve deployment

- **WHEN** the user approves an unexpired deployment request matching the project and operation
- **THEN** the bridge consumes the approval once and starts the configured command

#### Scenario: Reject missing or stale approval

- **WHEN** a deployment request lacks a matching unexpired approval
- **THEN** the bridge rejects it and starts no process

### Requirement: Deployment observability

The bridge SHALL stream deployment logs and final exit status, and the app SHALL show the configured preview or production URL after success.

#### Scenario: Deployment succeeds

- **WHEN** the deployment process exits successfully
- **THEN** the app shows success, retains the logs, and offers to open or refresh the configured production URL

#### Scenario: Deployment fails

- **WHEN** the deployment process exits non-zero or is stopped
- **THEN** the app shows failure or stopped status and retains the diagnostic output

### Requirement: Configuration-only rollback

Rollback SHALL be unavailable unless the selected project declares a rollback command, and it SHALL use the same approval flow as deployment.

#### Scenario: Rollback is not configured

- **WHEN** the user views deployment controls for a project without rollback configuration
- **THEN** the app does not offer an executable rollback action
