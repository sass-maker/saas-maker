# Hermes (merged from the former `call-hermes` skill)

Use Hermes only for optional repeatable research, analysis, skills that benefit
from its persistent learning loop, backup delivery, or workflows that need a
separate model provider. In Fleet, OpenClaw is the primary mobile operator.
Hermes should run as a launchd-supervised gateway only when it has a named job,
its own Telegram bot token, and an allowlist.

Before invoking, verify `hermes doctor` and `hermes status`. Give it a bounded
goal, workspace, and verification criteria. Treat all output as a proposal and
verify any resulting changes independently.

Hermes has no dedicated invocation contract in Fleet. Check `hermes --help`
for the installed version's syntax before the first run, and apply the shared
rules in `../SKILL.md` (explicit permission flags, worktree, `< /dev/null`,
verify the output yourself).
