# OSS stack for an "AI builds + operates a company" platform

Reference parts list for assembling a Polsia/Result-style autonomous business OS
from open-source + API building blocks. Picks favor the fleet's Cloudflare/TS stack.

## Context — what we're cloning

**Polsia** (`polsia.com`, "AI that runs your company while you sleep") and
**Result/Thesis** ("where the internet makes money") are autonomous
company-in-a-box platforms: a CEO/orchestrator agent plus role-based sub-agents
that **build** an app *and* **operate** the business (deploy code, run marketing,
handle support, manage finance), provisioning their own infra (servers, DB,
Stripe, repos, email) and running on a nightly loop with a morning summary email.

**Key finding:** there is **no single OSS equivalent.** OSS covers the
*build-an-app* half well and the *orchestration* layer very well. The
*operate-the-whole-business* half — marketing + finance + support + outreach tied
to one persistent "company brain" running nightly — does not exist as a drop-in
OSS product. That gap is the actual moat (and the part the funded incumbents still
do badly: wrong-name outreach, tasks marked done that never ship).

So this is **thin glue around 3 mature layers + real engineering on 1 unbuilt layer.**

---

## The three you can't download (this is the build)

1. **Company-brain state** — one persistent store per company: what exists,
   revenue, customers, bugs, decisions, history. The spine everything reads/writes.
   → Cloudflare Durable Object per company.
2. **Nightly cross-function orchestrator** — wakes, reads state, decides priorities
   across *all* functions, dispatches sub-agents, emails a summary. ~80% of the
   differentiation. → Cron Triggers / DO Alarms driving the runtime below.
3. **Reliability layer** — guardrails/verification that make operate-agents
   trustworthy. Unsolved by anyone, OSS or funded. This is where the product
   actually lives or dies.

Everything below is glue around those three.

---

## Orchestration runtime (the spine)

| Tool | Notes |
|---|---|
| [Mastra](https://github.com/mastra-ai/mastra) | TS agents/workflows/memory — best fit for the fleet ✅ |
| [Cloudflare Agents SDK](https://developers.cloudflare.com/agents/) | Stateful agents on Workers/DOs; pairs with Mastra |
| [LangGraph](https://github.com/langchain-ai/langgraph) | Python option; durable, auditable loops |
| [CrewAI](https://github.com/crewAIInc/crewAI) | Role-based "crew" abstraction out of the box |

## Build agent (writes & ships code)

| Tool | Notes |
|---|---|
| [OpenHands](https://github.com/OpenHands/OpenHands) | Strongest full SWE agent (~76k) |
| [Aider](https://github.com/Aider-AI/aider) | Lighter, git-native edits/commits |
| [SWE-agent](https://github.com/SWE-agent/SWE-agent) | Issue → PR |
| [Dyad](https://github.com/dyad-sh/dyad) / [bolt.diy](https://github.com/stackblitz-labs/bolt.diy) | Prompt → app if you want a builder UI feel |

⚠️ Avoid [gpt-pilot/Pythagora](https://github.com/Pythagora-io/gpt-pilot) — unmaintained;
a credential-stealer worm sat in the repo Aug 2025–Jun 2026. **Devika** is stale.

## Infra provisioning (SDK calls, not agents)

| Slot | Tool |
|---|---|
| Hosting/deploy | Cloudflare Workers/Pages (`wrangler`), or [Render API](https://render.com/docs/api) |
| Database | [Neon API](https://neon.tech/docs/reference/api-reference) (programmatic Postgres) or Cloudflare D1 |
| Payments | [Stripe Connect](https://stripe.com/connect) (per-company accounts + take-rate) |
| Repos | GitHub REST / Octokit (`@octokit/rest`) |
| Email inbox | [AgentMail](https://agentmail.to) (already used in fleet) or [Resend](https://resend.com) |
| Domains | Cloudflare Registrar API or [Namecheap API](https://www.namecheap.com/support/api/intro/) |

## Marketing / growth agents

| Slot | Tool |
|---|---|
| Outreach / cold email | [OpenOutreach](https://github.com/eracle/OpenOutreach), [SalesGPT](https://github.com/filip-michalsky/SalesGPT) |
| Lead enrichment | Bricks (OSS Clay alt), or [Apollo](https://apolloapi.io) / Clearbit APIs |
| Social posting | [Postiz](https://github.com/gitroomhq/postiz-app) (OSS scheduler) ✅ |
| Email campaigns | [Listmonk](https://github.com/knadh/listmonk) (OSS newsletters/campaigns) |
| Ads | Meta Marketing API / Google Ads API (no good OSS agent — direct SDK) |
| SEO / content | Build agent + [Serper](https://serper.dev) / [Tavily](https://tavily.com) for SERP data |

## Support agent

| Slot | Tool |
|---|---|
| Helpdesk core | [Chatwoot](https://github.com/chatwoot/chatwoot) (OSS support inbox, API-driven) ✅ |
| Answer engine | RAG over docs with Mastra memory + a vector store |

## Analytics

| Slot | Tool |
|---|---|
| Product analytics | [PostHog](https://github.com/PostHog/posthog) (OSS, self-host) ✅ |
| Web analytics | [Plausible](https://github.com/plausible/analytics) or [Umami](https://github.com/umami-software/umami) |

## Finance / ops

No real OSS agent here — wire the **Stripe API** directly (revenue, invoicing,
runway). [Medusa](https://github.com/medusajs/medusa) if commerce primitives are needed.

## Company-brain state + memory

| Slot | Tool |
|---|---|
| State store | Cloudflare Durable Objects (one per company) |
| Long-term/vector memory | [Mastra memory](https://mastra.ai/docs/memory/overview), [Cloudflare Vectorize](https://developers.cloudflare.com/vectorize/), or [pgvector](https://github.com/pgvector/pgvector) on Neon |
| Nightly loop scheduling | Cloudflare Cron Triggers / DO Alarms |

## Supporting tools

| Slot | Tool |
|---|---|
| Browsing/research | [Browserbase](https://browserbase.com) or Playwright, [Firecrawl](https://github.com/mendableai/firecrawl), Tavily |
| Models | Claude Opus/Sonnet via `free-ai` gateway first, paid escalation per AGENTS.md |
| Observability | [Langfuse](https://github.com/langfuse/langfuse) (OSS agent tracing) ✅ |

---

## Multi-agent "company/org" frameworks (reference)

Give an org-chart of role agents but stop at producing software — none run real
marketing/finance/support against external systems:
[MetaGPT](https://github.com/FoundationAgents/MetaGPT),
[ChatDev](https://github.com/OpenBMB/ChatDev),
[CAMEL](https://github.com/camel-ai/camel).

## Minimal-viable slice

Don't build all 12 cartridges. Smallest useful + reliable cut:
**build agent + infra provisioning + ONE operate function done well** (e.g.
support via Chatwoot, or outreach), all sharing the company-brain DO and driven by
the nightly loop. Prove the state model + loop + reliability on one function before
fanning out.

---

*Compiled 2026-06-27 from web research. Star counts approximate; verify activity
before adopting. Relates to the Foundry "blocks + COMPANY BRAIN" thesis.*
