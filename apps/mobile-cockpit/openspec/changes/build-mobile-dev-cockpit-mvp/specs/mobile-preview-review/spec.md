## ADDED Requirements

### Requirement: Isolated mobile preview

The app SHALL render a selected project's HTTP(S) preview URL in a WebView that has no access to machine-control credentials or bridge messaging APIs.

#### Scenario: Open preview

- **WHEN** a project has a valid preview URL and the user opens Preview
- **THEN** the WebView loads that URL with refresh, back, and external-browser controls

#### Scenario: Block unsupported navigation

- **WHEN** preview content navigates to a non-HTTP(S) scheme
- **THEN** the WebView does not load that scheme inside the preview

### Requirement: Capture preview evidence

The app SHALL capture an image of the visible preview and make it available for sharing or direct delivery to the active project agent.

#### Scenario: Capture screenshot

- **WHEN** the user taps Capture while the preview is visible
- **THEN** the app creates a local screenshot file and presents a share action or saved confirmation

#### Scenario: Deliver screenshot context

- **WHEN** the user chooses Send to agent and the project agent is running
- **THEN** the app sends a bounded compressed capture through the authenticated bridge connection and confirms acceptance

### Requirement: Preview device controls

The iOS app SHALL let the user rotate the preview between portrait and landscape and cycle a non-privileged system/light/dark theme hint without exposing machine-control APIs to the page.

#### Scenario: Rotate preview

- **WHEN** the user taps Rotate in the native preview
- **THEN** the app changes the iOS screen orientation and offers a return to portrait

#### Scenario: Change preview theme hint

- **WHEN** the user cycles the preview theme
- **THEN** the WebView reloads with only a theme dataset and CSS color-scheme hint injected before content load

### Requirement: Review repository changes

The bridge SHALL return Git status and a bounded textual diff for the configured repository, and the app SHALL render changed files and diff content.

#### Scenario: Refresh diff

- **WHEN** the user opens or refreshes Review
- **THEN** the app shows current changed files and the latest bounded unstaged and staged diff

#### Scenario: Diff exceeds limit

- **WHEN** Git diff output exceeds the configured byte limit
- **THEN** the bridge truncates it safely and marks the response as truncated

### Requirement: Stage reviewed files

The app SHALL allow a user to stage or unstage an individual file from the current bounded Git change set without accepting a path outside the configured repository.

#### Scenario: Stage a reviewed file

- **WHEN** the user stages a file listed in the current review
- **THEN** the bridge runs argv-based Git add for that exact repository-relative path and returns refreshed review state

### Requirement: Guard destructive Git actions

The bridge MUST require a fresh explicit approval before reverting a tracked file or committing staged changes, and MUST NOT expose reset, force push, untracked-file deletion, or arbitrary Git commands.

#### Scenario: Revert a tracked file

- **WHEN** the user approves an unexpired revert request for a tracked changed file
- **THEN** the bridge consumes the approval once, restores only that worktree path, and returns refreshed review state

#### Scenario: Preserve an untracked file

- **WHEN** a user attempts to revert an untracked file
- **THEN** the bridge rejects the action without deleting the file

#### Scenario: Commit staged changes

- **WHEN** the user approves an unexpired commit request with a bounded message and at least one staged file
- **THEN** the bridge commits only the already staged index and returns refreshed review state
