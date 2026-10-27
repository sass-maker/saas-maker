# Browser agent testing: measure verified feedback, not fast clicks

- Published: 2026-10-27
- Author: Sarthak Agrawal
- Reading time: 8 min read
- Canonical HTML: https://sassmaker.com/learnings/browser-agent-testing

This experiment compared UI-testing drivers and agent strategies
without confusing fast clicks with a correct result. The retained runner runs bounded commands,
records warm and cold timing, and requires a separate product-specific verifier
before counting a run as passed.

The runner does not replace Playwright, Maestro, AXe, Jev, Browser Use, or your
application tests. It gives those tools one measurement and evidence contract.

The measurements below were last run on **20 September 2026**. They cover seeded local web and iOS Simulator journeys on one Mac, not production traffic or a universal ranking. This article brings the completed experiment into SaaS Maker; the standalone site is retired.

The retained evidence contains **26 measured journey arms**, **118 verified completions across 129 attempts**, **seven additional probes** and **five seeded defect types**. Eleven tools were repeatedly benchmarked, ten received bounded screens, and four encountered dated setup blockers. The current map contains 80 tools, including 55 source-reviewed entries without runtime rankings. The Pomerado source review was added on **27 October 2026**; the historical measurements were not rerun.

## Current benchmark snapshot

The first adapter tested Vaultwealth web and native iOS journeys. These are
screening results, not universal tool rankings:

- **Repeatable web regression — saved Playwright tests.** Reliable baseline; no tested replacement met the 2× adoption target.
- **Exploratory web navigation — Jev, with an independent verifier.** Search passed 5/5 and detected the seeded stale-result fault, but login is unsupported because password inputs are excluded.
- **Repeated semantic web action — Stagehand cached replay remains promising.** Search replay passed 4/4 at a 2.201 s median with no repeat model calls after 25.544 s of authoring. This was promising screening evidence, not a 2× improvement.
- **Repeatable iOS regression — saved Maestro flows.** Slower in the tested login runs, but the more dependable retained baseline.
- **Targeted iOS inspection and actions — AXe or XcodeBuildMCP.** AXe login was faster in screening, but readiness, configuration and text-entry failures prevented general adoption.

Read the full [screening report](https://github.com/sarthakagrawal927/agent-testing/blob/181379a075113aab9d8d22fdb87e3642ca13bb4b/adapters/vaultwealth/runtime/REPORT.md),
[round-two comparison](https://github.com/sarthakagrawal927/agent-testing/blob/181379a075113aab9d8d22fdb87e3642ca13bb4b/adapters/vaultwealth/runtime/ROUND2.md), and the
[expanded web](https://github.com/sarthakagrawal927/agent-testing/blob/181379a075113aab9d8d22fdb87e3642ca13bb4b/adapters/vaultwealth/runtime/EXPANDED_WEB.md) and
[native readiness](https://github.com/sarthakagrawal927/agent-testing/blob/181379a075113aab9d8d22fdb87e3642ca13bb4b/adapters/vaultwealth/runtime/EXPANDED_NATIVE.md) screens
before using the numbers in a decision. No tool has yet qualified as the
overall winner.

## When the agent builds a reusable tool

Website-to-API and MCP generators belong in the comparison too. [Pomerado](https://github.com/Pomerado/pomerado) takes a website task, explores it with a browser and generates a source-code integration served through MCP. Its [architecture documentation](https://github.com/Pomerado/pomerado/blob/main/docs/how-it-works.md) separates the agent that builds the integration, Guardian's authoring-time review, and the runtime that executes it.

The open-source core is MIT-licensed. Authoring uses OpenAI models and requires a paid model API; running a generated integration makes no model calls. That makes it relevant to repeated workflows, but a generated tool is still an executor. It does not independently prove that a saved change persisted or that every returned row satisfies a filter.

For this kind of tool, measure the first successful build separately from repeat execution. Vary the inputs, test empty results and pagination, verify persisted outcomes independently, and record what happens when the site changes. Count repair work, retries and human intervention alongside execution time.

Pomerado is **source-reviewed only** here. It has no local execution, speed, reliability or defect-detection result in this experiment. Its upstream claims are not benchmark findings. Stagehand's measured cached replay is a related example of separating authoring from repeat execution; its results do not establish Pomerado's performance.

## Clone and prove the runner works

The core has no package dependencies. It needs Node.js 22 or newer.

```sh
gh repo clone sarthakagrawal927/agent-testing
cd agent-testing
pnpm test

node bin/agent-testing.mjs validate \
  --manifest fixtures/good.manifest.json
node bin/agent-testing.mjs run \
  --manifest fixtures/good.manifest.json \
  --out artifacts/quickstart
node bin/agent-testing.mjs summarize \
  --receipt artifacts/quickstart/receipt.json
```

The generated `artifacts/` directory is ignored. A run never overwrites a
non-empty output directory.

## Add your product

Keep the retained runner beside the application rather than copying its code into the application. Add a
directory such as `adapters/my-product/` containing:

- one manifest per journey and candidate;
- bounded commands for reset, readiness, workflow, and verification;
- any product-specific orchestration scripts;
- a README describing local startup, seed data, tool pins, and known limits;
- an opt-in patch only if the app needs debug hooks that cannot live in normal
  test code.

A minimal manifest looks like this:

```json
{
  "schemaVersion": "fleet.agent-testing.manifest.v1",
  "id": "my-product.web.search.playwright",
  "platform": "web",
  "journey": "dynamic-search",
  "candidate": "playwright-saved",
  "sample": "screening",
  "workingDirectory": "../../../my-product-worktree",
  "runs": { "warm": 5, "cold": 0 },
  "phases": {
    "reset": {
      "command": ["node", "scripts/reset-benchmark-data.mjs"],
      "timeoutMs": 10000
    },
    "readiness": {
      "command": ["node", "scripts/check-local-readiness.mjs"],
      "timeoutMs": 10000
    },
    "workflow": {
      "command": ["pnpm", "exec", "playwright", "test", "tests/search.spec.ts"],
      "timeoutMs": 120000
    },
    "verification": {
      "command": ["node", "scripts/verify-search-result.mjs"],
      "timeoutMs": 10000
    }
  }
}
```

`workingDirectory` is resolved relative to the manifest. Use a clean isolated
product worktree and a seeded non-production backend. Commands must be arrays,
must not invoke a shell, and must have bounded timeouts.

The verifier is intentionally separate from the workflow. It should check the
displayed result, persisted backend state where relevant, and explicit visual
evidence. A driver exiting successfully is not proof that the product behaved
correctly.

## Run a useful comparison

1. Choose one real journey and give every candidate the same starting state,
   interactions, assertions, and screenshot checkpoints.
2. Start with five warm screening runs. Measure cold startup separately.
3. Run clean and individually broken variants. Hide each defect from an
   exploring agent and let the independent verifier classify the outcome.
4. Record initial authoring cost separately from repeat execution.
5. Promote a candidate to 20 warm and three cold runs only when screening is
   promising.
6. Adopt only when it is at least 2x faster, or cuts model usage by at least
   50% without becoming slower, with no missed seeded defects or observed
   reliability regression.

Report median and observed p95 alongside verified completions, model calls,
spend, retries, interventions, setup effort, and workflow repair time. At these
sample sizes, tail latency and reliability estimates remain preliminary.

## Vaultwealth example

The retained Vaultwealth adapter applies only to a clean, non-main worktree:

```sh
node adapters/vaultwealth/prepare.mjs check --target /path/to/vaultwealth-worktree
node adapters/vaultwealth/prepare.mjs apply --target /path/to/vaultwealth-worktree
```

After preparation, follow the generated
`local-agent-eval/fast-testing/README.md` in that worktree. Do not merge the
experiment patch into the application merely to run the benchmark.

## Retained evidence and tool map

The full datasets now live alongside this article in SaaS Maker:

- [80-tool catalogue](/research/browser-agent-testing/tools.json): source links, evidence labels, costs, version pins or concrete applicability boundaries, across seven categories.
- [Experiment records](/research/browser-agent-testing/experiments.json): all 26 measured journey arms, verified pass denominators, median and observed p95, model usage, fault outcomes, seven probes and ten experiment write-ups.
- [Observed version pins](/research/browser-agent-testing/versions.json): the exact tool and environment versions recorded for the historical runs.

The categories separate saved web automation, adaptive browser agents, agent evaluation suites, remote browser infrastructure, visual verification, iOS and mobile tools, and local model helpers. Remote infrastructure and source-reviewed alternatives have fit boundaries, not invented local scores.

“Benchmarked” means repeated local execution. “Screened” means a bounded local probe. “Setup-blocked” records a named prerequisite or bounded failure without judging tool quality. “Source-reviewed” records official-source research without a runtime ranking.

The [original repository](https://github.com/sarthakagrawal927/agent-testing) retains the complete source, reports and reproduction commands. This article and the linked snapshots are a retained research publication. Run a fresh comparison when a concrete application journey or material tool change justifies it; the existence of another tool is not a reason to restart the entire benchmark catalogue.
