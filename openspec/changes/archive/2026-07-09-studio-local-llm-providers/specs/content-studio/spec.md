# content-studio delta

## MODIFIED Requirements

### Requirement: Studio tools run at zero cost without credentials
Every studio tool SHALL produce usable output with no API keys configured, via
deterministic template generation. When LLM providers are available, tools
SHALL try them in a configurable chain — default order `free-ai` (fleet
gateway, `FREE_AI_API_KEY`), `codex` (local Codex CLI on PATH), `deepseek`
(`DEEPSEEK_API_KEY`) — using the first configured provider that succeeds, and
SHALL fall back to the next provider and finally to templates on failure. The
chain order SHALL be overridable via `STUDIO_LLM_PROVIDERS`.

#### Scenario: No provider configured
- **WHEN** a studio tool runs and no LLM provider is configured or installed
- **THEN** it returns deterministic template-based output and marks the result `source: "template"`

#### Scenario: Provider configured
- **WHEN** at least one provider in the chain is configured and the request succeeds
- **THEN** the tool returns LLM output marked `source: "llm"` with the provider name in the result envelope

#### Scenario: Provider failure falls through the chain
- **WHEN** the first configured provider fails and a later provider succeeds
- **THEN** the tool returns that later provider's output without surfacing an error
