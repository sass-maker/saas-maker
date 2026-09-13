# Upstream and adaptation notes

Source: <https://github.com/donvito/codex-astra-luna-orchestrator>

Pinned revision: `f1de1b8729c8ccfb7978321b4764c58bd34c8493`

Upstream license: Apache License 2.0. See `../LICENSE`.

Fleet's adaptation keeps the Astra-root/Luna-executor pattern and the bounded
role contracts. It intentionally does not vendor or install upstream `.codex`
configuration, agent TOML profiles, installers, token-usage tooling, or root
`AGENTS.md` because those files can overwrite existing project or global policy.

Material changes to the upstream skill:

- delegation requires explicit user or current project-policy authority;
- the live collaboration tool catalog controls model names and fork options;
- model overrides use bounded context rather than assuming full-history forks;
- dirty-worktree preservation and one-writer ownership are explicit;
- root fallback is allowed only when higher-priority policy permits it;
- the completion receipt distinguishes actual spawn/model evidence from claims.

When refreshing, compare the pinned revision with upstream first. Port useful
behavior deliberately instead of replacing the Fleet adaptation wholesale.
