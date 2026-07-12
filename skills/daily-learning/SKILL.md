---
name: daily-learning
description: Create a fresh private 30-minute Fleet learning session from Telegram, OpenClaw, Hermes, or the terminal. Use when the operator asks to learn, study, review, get today's session, or focus on a named Fleet project or learning source.
---

# Daily Learning

Create a new session link with the Fleet Ops command:

```bash
scripts/agent-bin/learning-session [source]
```

Run it from the Fleet Ops repository. Omit `source` for a balanced High Signal
plus due-learning session. Pass a current product name such as `posttrainllm`,
`MAL Explorer`, or `Research Papers` to focus the session.

Return the generated URL directly. The site requires the owner's Google account.
Each invocation creates a new session ID, so there is no daily limit. Questions
come at the end and their result controls FSRS rescheduling.

The managed machine cron sends one balanced link through OpenClaw Telegram at
08:05 Asia/Kolkata each day. This scheduled link does not limit on-demand runs.

If the command reports that its catalog is missing, run
`scripts/agent-bin/sync-learning-sources` once and retry.
