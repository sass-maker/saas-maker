# Fleet Ops

Read and follow the Fleet-wide policy at `../AGENTS.md` first. This directory
is the version-controlled home for shared fleet tooling: skills, scripts,
teammates, automation, docs, templates, the ops console, and OpenClaw harness
setup.

## Local Rules

- Keep reusable agent behavior in this repo, not in global profile directories.
- Keep machine-local OpenClaw bootstrap files out of git; `agent-stack.sh
  install-agents` adds them to each workspace's local git exclude file.
- Do not deploy, change DNS, rotate credentials, or edit production config from
  here unless the user explicitly asks for that action.
- Before changing support-project workflows, verify against `docs/research-harness.md`
  and `docs/fleet-agent-standards.md`.

