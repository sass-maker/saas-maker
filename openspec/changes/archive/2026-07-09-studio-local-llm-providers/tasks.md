# Tasks — studio local LLM providers

- [x] 1.1 Rewrite `src/studio/llm.js` as provider chain (free-ai, codex, deepseek) with back-compat constructor
- [x] 1.2 `test/studio-llm-providers.test.js` — chain order, fall-through, codex parsing, free-ai request shape
- [x] 1.3 Existing suites green unchanged (back-compat proof)
- [x] 2.1 Live proof: real `codex exec` JSON call; free-ai if key present
- [x] 2.2 `.env.example` + `docs/content-studio.md` env section
- [x] 2.3 Archive change; PROJECT_STATUS note
