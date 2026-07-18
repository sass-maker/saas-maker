# Codevetter

**Desktop-first AI code review for agent-generated code.**

Codevetter builds tools for engineers shipping AI-generated PRs. Our flagship
product is [CodeVetter](https://codevetter.com) — a local-first code review
workbench with a Tauri shell, SQLite storage, and evidence-backed review loops.
Your repo never hits a central server.

## What we ship

- **[CodeVetter](https://codevetter.com)** — desktop AI code review workbench (macOS, ISC license). Local SQLite, Tauri shell, optional Claude/Codex/Gemini CLI backends.
- **[Starboard](https://starboard.codevetter.com)** — GitHub stars organizer with semantic search. A sub-product for repo intelligence.

## Product domains

| Product | URL | What it does |
|---|---|---|
| CodeVetter | https://codevetter.com | Desktop-first AI code review workbench |
| Starboard | https://starboard.codevetter.com | GitHub stars organizer with semantic search |

## Fleet hub

Codevetter is one of the four spotlight products on Sarthak's personal landing
page. The broader fleet directory lives at [SaaS Maker](https://sassmaker.com).

Codevetter is part of the [Foundry fleet](https://sassmaker.com) — a personal
product fleet by Sarthak Agrawal. See the [fleet build log](https://sassmaker.com/build-log)
for the real git history behind these products.

- **Hub**: https://sassmaker.com
- **Fleet build log**: https://sassmaker.com/build-log
- **CodeVetter product page**: https://sassmaker.com/p/codevetter
- **Starboard product page**: https://sassmaker.com/p/starboard

## Agent surfaces

Every product exposes machine-readable entrypoints:

- CodeVetter: https://codevetter.com/llms.txt · https://codevetter.com/api/ai · https://codevetter.com/index.md
- Starboard: https://starboard.codevetter.com/llms.txt · https://starboard.codevetter.com/api/ai · https://starboard.codevetter.com/index.md
