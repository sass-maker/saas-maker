# faceless-workflow delta

## MODIFIED Requirements

### Requirement: Posting handoff
The workflow SHALL optionally hand a rendered video to the existing posting
path by saving the idea/draft with rendered status and printing the exact
existing post command; it SHALL NOT post automatically without the explicit
flag used by the existing Rust posting layer. When given an existing idea id
the workflow SHALL update that idea's status in place instead of creating a
duplicate entry, and the run summary SHALL include the render quality report.

#### Scenario: Handoff without auto-post
- **WHEN** a workflow render completes without a post flag
- **THEN** no posting API is called and the summary includes the manual post command

#### Scenario: Existing idea advanced
- **WHEN** the workflow runs with an `ideaId` from the backlog
- **THEN** that idea moves to `rendered` and no new idea entry is created
