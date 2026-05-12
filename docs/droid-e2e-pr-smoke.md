# Droid E2E PR Smoke

A successful Droid run proves end-to-end agent capability on this repository:

- **Repository hydration** — the Droid sandbox clones, installs dependencies, and reaches a ready state without manual intervention.
- **OpenCode execution with DeepSeek** — the agent runtime (OpenCode + DeepSeek model) correctly interprets instructions, navigates the codebase, and produces targeted changes.
- **Patch capture** — all file modifications are captured, staged, and committed with a meaningful message.
- **Validation** — the patched code passes linting, typechecking, and unit tests, confirming no regressions.
- **Sandbox cleanup** — the ephemeral environment tears down cleanly, leaving no leaked resources.
- **Draft PR creation** — the branch is pushed and a draft pull request is opened, completing the outer feedback loop.
