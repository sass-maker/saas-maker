# Hermes (merged from the former `call-hermes` skill)

Use Hermes only for optional repeatable research, analysis, skills that benefit
from its persistent learning loop, or workflows that need a separate model
provider. Hermes also handles Fleet Telegram delivery. Run its launchd-supervised
gateway with a named job, a Telegram bot token, and an allowlist.

Before invoking, verify `hermes doctor` and `hermes status`. Give it a bounded
goal, workspace, and verification criteria. Treat all output as a proposal and
verify any resulting changes independently.

Hermes has no dedicated invocation contract in Fleet. Check `hermes --help`
for the installed version's syntax before the first run, and apply the shared
rules in `../SKILL.md` (explicit permission flags, worktree, `< /dev/null`,
verify the output yourself).
