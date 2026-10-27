# Browser agent testing: measure verified feedback, not fast clicks

- Published: 2026-10-27
- Author: Sarthak Agrawal
- Updated: 2026-10-28
- Reading time: 18 min read
- Canonical HTML: https://sassmaker.com/learnings/browser-agent-testing

This experiment compared UI-testing drivers and agent strategies
without confusing fast clicks with a correct result. The retained runner runs bounded commands,
records warm and cold timing, and requires a separate product-specific verifier
before counting a run as passed.

The runner does not replace Playwright, Maestro, AXe, Jev, Browser Use, or your
application tests. It gives those tools one measurement and evidence contract.

The measurements below were last run on **20 September 2026**. They cover seeded local web and iOS Simulator journeys on one Mac, not production traffic or a universal ranking. This article brings the completed experiment into SaaS Maker; the standalone site is retired.

The retained evidence contains **26 measured journey arms**, **118 verified completions across 129 attempts**, **seven additional probes** and **five seeded defect types**. Eleven tools were repeatedly benchmarked, ten received bounded screens, and four encountered dated setup blockers. The current map contains 80 tools, including 55 source-reviewed entries without runtime rankings. The Pomerado source review was added on **27 October 2026**; the historical measurements were not rerun.

Jump to the [journey timings](#journey-timings-verified-results-and-model-usage), [other probes](#other-measured-probes), [experiment records](#what-each-experiment-established), [version pins](#exact-observed-versions-and-environment), or [Pomerado discussion](#when-the-agent-builds-a-reusable-tool).

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

## The complete measured results

These are the original September measurements. A verified pass requires the independent verifier to accept the outcome. A fast unsuccessful attempt remains a failure, and an unavailable measurement is shown as **—**, not zero.

On a phone or narrow window, scroll each table horizontally to read every column. Tables can also receive keyboard focus for scrolling.

### Coverage and cost

<div class="learning-results-table learning-results-table--summary" role="region" aria-label="Experiment coverage and cost" tabindex="0">

| Measure | Recorded value |
| --- | --- |
| Catalogue tools | 80 |
| Executed tools | 21 |
| Repeatedly benchmarked tools | 11 |
| Bounded tool screens | 10 |
| Setup-blocked tools | 4 |
| Source-reviewed tools | 55 |
| Measured journey arms | 26 |
| Verified journey completions / attempts | 118/129 |
| Additional measured probes | 7 |
| Experiment records | 10 |
| Seeded defect types | 5 |
| Estimated accepted paid API spend across the Jev evidence | $0.00479976 (approximately $0.00480) |

</div>

### Journey timings, verified results and model usage

Medians and observed p95 use the timing basis printed under each mode. For the batched Codex arm, timings cover all attempts despite zero qualified completions; Browser Use timings cover successful verified passes. At these sample sizes, observed p95 is usually the maximum and is not a reliable population tail estimate. Stagehand authoring is separate from replay.

No candidate completed the planned 20 warm and three cold qualification runs across every journey. The five-run and four-replay results remain screening evidence.

#### Web: Login

<div class="learning-results-table learning-results-table--timings" role="region" aria-label="Web Login benchmark results" tabindex="0">

| Mode and timing basis | Median | Observed p95 | Verified / attempts | Model usage / cost | Seeded fault outcome |
| --- | --- | --- | --- | --- | --- |
| <strong>Playwright saved</strong><br><small>verified passes</small> | 1.178 s | 1.400 s | 5/5 | 0 calls · $0 | clipped control detected |
| <strong>agent-browser direct</strong><br><small>verified passes</small> | 2.714 s | 3.846 s | 5/5 | 0 calls · $0 | clipped control detected |
| <strong>agent-browser batch</strong><br><small>verified passes</small> | 1.323 s | 1.734 s | 5/5 | 0 calls · $0 | clipped control detected |
| <strong>Playwright CLI</strong><br><small>verified passes; p95 unavailable</small> | 3.235 s | — | 5/5 | 0 calls · $0 | no fault sample |

</div>

#### Web: Edit + reload

<div class="learning-results-table learning-results-table--timings" role="region" aria-label="Web Edit + reload benchmark results" tabindex="0">

| Mode and timing basis | Median | Observed p95 | Verified / attempts | Model usage / cost | Seeded fault outcome |
| --- | --- | --- | --- | --- | --- |
| <strong>Playwright saved</strong><br><small>verified passes</small> | 1.898 s | 1.950 s | 5/5 | 0 calls · $0 | 3/3 write faults detected |
| <strong>agent-browser direct</strong><br><small>verified passes</small> | 1.762 s | 1.795 s | 5/5 | 0 calls · $0 | 3/3 write faults detected |
| <strong>agent-browser batch</strong><br><small>no verified completion</small> | — | — | 0/5 | 0 calls · $0 | not eligible after clean failure |
| <strong>Playwright CLI</strong><br><small>verified passes; p95 unavailable</small> | 3.076 s | — | 5/5 | 0 calls · $0 | no fault sample |

</div>

#### Web: Search

<div class="learning-results-table learning-results-table--timings" role="region" aria-label="Web Search benchmark results" tabindex="0">

| Mode and timing basis | Median | Observed p95 | Verified / attempts | Model usage / cost | Seeded fault outcome |
| --- | --- | --- | --- | --- | --- |
| <strong>Playwright saved</strong><br><small>verified passes</small> | 2.768 s | 2.796 s | 5/5 | 0 calls · $0 | stale result detected |
| <strong>agent-browser direct</strong><br><small>verified passes</small> | 2.826 s | 2.833 s | 5/5 | 0 calls · $0 | stale result detected |
| <strong>agent-browser batch</strong><br><small>verified passes</small> | 2.649 s | 2.836 s | 5/5 | 0 calls · $0 | stale result detected |
| <strong>Puppeteer Core</strong><br><small>verified passes</small> | 2.081 s | 2.146 s | 5/5 | 0 calls · $0 | stale result detected |
| <strong>WebdriverIO</strong><br><small>verified passes</small> | 2.958 s | 3.087 s | 5/5 | 0 calls · $0 | stale result detected |
| <strong>Selenium WebDriver</strong><br><small>verified passes</small> | 3.633 s | 3.651 s | 5/5 | 0 calls · $0 | stale result detected |
| <strong>Nightwatch</strong><br><small>verified passes</small> | 5.425 s | 5.700 s | 5/5 | 0 calls · $0 | stale result detected |
| <strong>Taiko</strong><br><small>verified passes</small> | 23.850 s | 23.921 s | 5/5 | 0 calls · $0 | stale result detected |
| <strong>Stagehand cached</strong><br><small>verified replays</small><br><small>Authoring: 25.544 s</small> | 2.201 s | 2.233 s | 4/4 | 0 replay calls · $0 | stale result detected |
| <strong>Stagehand uncached</strong><br><small>verified passes</small> | 26.951 s | 31.401 s | 5/5 | 3 local calls · $0 | stale result detected |
| <strong>Jev + Bonsai</strong><br><small>verified passes</small> | 11.101 s | 11.391 s | 5/5 | 7 paid selector + 3 local calls · ~$0.00063/run | stale result detected |
| <strong>Browser Use + Bonsai</strong><br><small>successful verified passes</small> | 90.730 s | 93.623 s | 4/5 | 8 local calls on successes · $0 | stale result detected |

</div>

#### Web: Adaptive login

<div class="learning-results-table learning-results-table--timings" role="region" aria-label="Web Adaptive login benchmark results" tabindex="0">

| Mode and timing basis | Median | Observed p95 | Verified / attempts | Model usage / cost | Seeded fault outcome |
| --- | --- | --- | --- | --- | --- |
| <strong>Codex stepwise</strong><br><small>verified passes</small> | 155.971 s | 225.686 s | 5/5 | 918,042 median input tokens | clipped control detected separately |
| <strong>Codex batched</strong><br><small>all attempts; 2/5 functional</small> | 123.684 s | 139.657 s | 0/5 | 398,585 median input tokens | clipped calibration noticed; unqualified |

</div>

#### iOS: Login

<div class="learning-results-table learning-results-table--timings" role="region" aria-label="iOS Login benchmark results" tabindex="0">

| Mode and timing basis | Median | Observed p95 | Verified / attempts | Model usage / cost | Seeded fault outcome |
| --- | --- | --- | --- | --- | --- |
| <strong>Maestro saved flow</strong><br><small>verified warm passes</small> | 32.964 s | 34.775 s | 5/5 | 0 calls · $0 | clipped control detected |
| <strong>AXe batch</strong><br><small>verified warm passes</small> | 12.612 s | 12.892 s | 5/5 | 0 calls · $0 | clipped control detected |

</div>

#### iOS: Search

<div class="learning-results-table learning-results-table--timings" role="region" aria-label="iOS Search benchmark results" tabindex="0">

| Mode and timing basis | Median | Observed p95 | Verified / attempts | Model usage / cost | Seeded fault outcome |
| --- | --- | --- | --- | --- | --- |
| <strong>Maestro saved flow</strong><br><small>verified warm passes</small> | 34.673 s | 41.146 s | 5/5 | 0 calls · $0 | no fault sample |
| <strong>AXe batch, one-char typing</strong><br><small>verified warm passes</small> | 15.279 s | 15.317 s | 5/5 | 0 calls · $0 | no fault sample |

</div>

### Other measured probes

These seven probes cover text generation, diagnostics, individual actions and simulator readiness. They are separate from the 26 end-to-end journey arms; a readiness result does not establish saved-flow reliability.

<div class="learning-results-table learning-results-table--timings" role="region" aria-label="Other measured probes" tabindex="0">

| Probe | Median | Observed p95 | Result | Recorded detail | Boundary |
| --- | --- | --- | --- | --- | --- |
| Bonsai text helper · budget-only | 4.907 s | 8.943 s | 25/25 | 9.252 GB sampled RSS · 4,760 prompt / 2,525 output tokens | Synthetic text-helper requests |
| Bonsai text helper · no-thinking | 1.082 s | 1.193 s | 25/25 | 7.305 GB sampled RSS · 3,860 prompt / 215 output tokens | Synthetic text-helper requests |
| Chrome DevTools MCP diagnostic bundle | 0.826 s | — | 5/5 | Lighthouse snapshot 1.243 s | Diagnostic collection, not a journey |
| XcodeBuildMCP cash-field action | 3.834 s | — | 5/5 | 1.343 s semantic observation median · ~35 s setup | No save/relaunch qualification |
| AXe app-process relaunch readiness | — | — | 0/3 standalone | Launch 1.52–1.64 s · Maestro-assisted tree 6.12–6.23 s | Startup diagnostic, not cold journey |
| ios-simulator-mcp readiness | — | — | passed | 17 tools · 6,940-character accessibility description | Readiness only |
| Mobile MCP readiness | — | — | passed | 32 tools · 27 elements listed | Readiness only; temporary agent removed |

</div>

## What each experiment established

The ten retained experiment records include the numeric findings and their original qualification limits.

### 1. Saved web workflows

**Status:** complete screening. **Arms:** Playwright · agent-browser direct · agent-browser batch.

Playwright remained the baseline. agent-browser batching improved its own login time, but no candidate met the 2x adoption threshold.

- Login: Playwright 1.178 s; direct 2.714 s; batch 1.323 s medians; all 5/5.
- Edit: Playwright 1.898 s and direct 1.762 s medians; batch failed 0/5.
- Search: Playwright 2.768 s; direct 2.826 s; batch 2.649 s medians; all 5/5.

[Original evidence](https://github.com/sarthakagrawal927/agent-testing/blob/181379a075113aab9d8d22fdb87e3642ca13bb4b/adapters/vaultwealth/runtime/REPORT.md#web-saved-workflows-no-ai).

### 2. Seeded web defects

**Status:** complete screening. **Arms:** Playwright oracle · agent-browser direct · agent-browser batch where viable.

The viable Playwright and direct arms detected all five seeded fault types with no clean-run false failure in the selected trials.

- Detected save failure, wrong persisted value, duplicate write, stale search and clipped control.
- The visual oracle detected 53.14% changed control pixels against a 2% limit.
- This validates fixed oracles; it is not a blinded AI discovery rate.

[Original evidence](https://github.com/sarthakagrawal927/agent-testing/blob/181379a075113aab9d8d22fdb87e3642ca13bb4b/adapters/vaultwealth/runtime/REPORT.md#seeded-web-defects).

### 3. Coding-agent stepwise versus batched interaction

**Status:** complete screening. **Arms:** Stepwise Codex · Batched Codex.

Stepwise passed 5/5. Batched qualified 0/5 and reduced total reported input mostly through cache, not uncached reasoning.

- Stepwise verified median 155.971 s; 5/5.
- Batched median attempt 123.684 s; only 2/5 functional completions and 0/5 within the recovery gate.
- Total input fell 56.6%, while uncached input fell 8.6%.

[Original evidence](https://github.com/sarthakagrawal927/agent-testing/blob/181379a075113aab9d8d22fdb87e3642ca13bb4b/adapters/vaultwealth/runtime/REPORT.md#agent-interaction-strategies).

### 4. Jev specialist with local Bonsai text helper

**Status:** complete screening. **Arms:** Jev + TypeSafe selection + Bonsai text · Fixed Playwright/backend oracle.

Authenticated search passed 5/5 and found the hidden stale-search fault. Login is unsupported because Jev excludes password inputs.

- Clean search median 11.101 s; observed p95 11.391 s.
- Seven TypeSafe calls plus three local Bonsai calls per run.
- Estimated TypeSafe spend $0.00313047 across five clean runs; about $0.00063 per run.

[Original evidence](https://github.com/sarthakagrawal927/agent-testing/blob/181379a075113aab9d8d22fdb87e3642ca13bb4b/adapters/vaultwealth/runtime/REPORT.md#optional-jev-specialist-with-local-bonsai).

### 5. iOS saved flows: Maestro versus AXe

**Status:** screening incomplete. **Arms:** Maestro saved flow · AXe batch.

AXe was much faster on warm login and search, but cold accessibility readiness and inconsistent text entry prevented replacement.

- Login: Maestro 32.964 s versus AXe 12.612 s medians; both 5/5.
- Search: Maestro 34.673 s versus AXe 15.279 s medians; both 5/5 with journey-specific AXe typing configuration.
- Three app-process relaunch probes returned an empty AXe tree until a Maestro hierarchy request.

[Original evidence](https://github.com/sarthakagrawal927/agent-testing/blob/181379a075113aab9d8d22fdb87e3642ca13bb4b/adapters/vaultwealth/runtime/REPORT.md#native-saved-workflows-and-startup-diagnostic).

### 6. Local Bonsai 27B text-helper compatibility

**Status:** complete synthetic screening. **Arms:** Reasoning budget only · Explicit no-thinking template.

Both profiles passed 25/25 exact responses. Explicit no-thinking was 4.54x faster and used less sampled memory.

- Budget-only median 4.907 s; observed p95 8.943 s; sampled peak RSS 9.252 GB.
- No-thinking median 1.082 s; observed p95 1.193 s; sampled peak RSS 7.305 GB.
- This was a text-helper probe, not a browser-agent or defect-detection result.

[Original evidence](https://github.com/sarthakagrawal927/agent-testing/blob/181379a075113aab9d8d22fdb87e3642ca13bb4b/adapters/vaultwealth/runtime/BONSAI.md).

### 7. Round-two local browser tools

**Status:** complete screening. **Arms:** Stagehand uncached · Stagehand cached · Browser Use · Playwright CLI · Chrome DevTools MCP.

Stagehand cache was the most promising replay result, but missed the 2x gate. Browser Use was slow and 4/5. Chrome DevTools MCP was useful for diagnostics only.

- Stagehand uncached 26.951 s median; 5/5. Cached 2.201 s median; 4/4 after 25.544 s authoring.
- Browser Use 90.730 s median among successes; 4/5.
- Chrome DevTools MCP diagnostic bundle 0.826 s median; Lighthouse snapshot 1.243 s.

[Original evidence](https://github.com/sarthakagrawal927/agent-testing/blob/181379a075113aab9d8d22fdb87e3642ca13bb4b/adapters/vaultwealth/runtime/ROUND2.md).

### 8. Additional native candidates

**Status:** bounded probe. **Arms:** XcodeBuildMCP · XCUITest feasibility · Detox feasibility.

XcodeBuildMCP replaced the formatted cash field in 5/5 probes but no save/relaunch journey was qualified. XCUITest and Detox were setup-blocked by checkout structure.

- XcodeBuildMCP action median 3.834 s; semantic observation median 1.343 s.
- Maestro/debug setup still took about 35 s.
- No claim is made that XCUITest or Detox failed as tools.

[Original evidence](https://github.com/sarthakagrawal927/agent-testing/blob/181379a075113aab9d8d22fdb87e3642ca13bb4b/adapters/vaultwealth/runtime/ROUND2.md#other-round-two-findings).

### 9. Expanded saved-web driver screen

**Status:** complete screening. **Arms:** Puppeteer Core · Selenium WebDriver · WebdriverIO · Nightwatch · Taiko.

All five candidates completed five independently verified clean searches and detected the stale-search fault. Puppeteer was fastest, but did not meet the 2x adoption gate against Playwright.

- Workflow medians: Puppeteer 2.081 s; WebdriverIO 2.958 s; Selenium 3.633 s; Nightwatch 5.425 s; Taiko 23.850 s.
- Every candidate passed 5/5 clean runs and detected the stale-search mismatch through the backend/UI oracle.
- TestCafe 3.7.6 hit the bounded 60 s setup timeout; Cypress 16.1.0 had no isolated application binary. Neither is counted as a tool failure.

[Original evidence](https://github.com/sarthakagrawal927/agent-testing/blob/181379a075113aab9d8d22fdb87e3642ca13bb4b/adapters/vaultwealth/runtime/EXPANDED_WEB.md).

### 10. Expanded native agent-tool readiness

**Status:** complete bounded screen. **Arms:** ios-simulator-mcp · Mobile MCP · fb-idb.

Both MCP servers started and found the dedicated simulator. ios-simulator-mcp returned the accessibility tree through isolated idb; Mobile MCP listed 27 elements and its temporary device agent was removed afterward.

- ios-simulator-mcp 2.1.0 exposed 17 tools and returned a 6,940-character accessibility description.
- Mobile MCP 1.0.4 exposed 32 tools and listed 27 elements with device agent 0.0.26.
- These are readiness probes, not saved-flow latency or defect-detection results.

[Original evidence](https://github.com/sarthakagrawal927/agent-testing/blob/181379a075113aab9d8d22fdb87e3642ca13bb4b/adapters/vaultwealth/runtime/EXPANDED_NATIVE.md).

## Exact observed versions and environment

**Machine:** Apple M5 Pro, 48 GiB RAM, Darwin 27.0.0. **Browser:** Dedicated Chromium at 1280x800. **Simulator:** iPhone 16 Pro, iOS 26.5.

These pins describe the historical runs. They do not establish results for later releases. The model and runtime hashes remain visible so the retained evidence can be traced precisely.

<div class="learning-results-table" role="region" aria-label="Exact observed tool and runtime versions" tabindex="0">

| Tool or runtime | Observed version or revision | Recorded from |
| --- | --- | --- |
| Playwright | 1.62.1 | experiment package lock |
| agent-browser | 0.38.1 | experiment package lock |
| @playwright/cli | 0.1.21 | experiment package lock |
| Puppeteer Core | 24.43.1 | expanded screen package lock |
| Selenium WebDriver | 4.49.0 | expanded screen package lock |
| ChromeDriver | 151.0.5 / 151.0.7922.77 | expanded screen package lock and binary |
| WebdriverIO | 9.31.9 | expanded screen package lock |
| Nightwatch | 3.16.0 | expanded screen package lock |
| Taiko | 1.5.0 | expanded screen package lock |
| TestCafe | 3.7.6 | bounded setup attempt |
| Cypress | 16.1.0 package; application binary absent | bounded setup probe |
| Stagehand | 3.4.0 | experiment package lock |
| Browser Use | 0.13.10 | isolated Python environment |
| chrome-devtools-mcp | 1.9.0 | experiment package lock |
| Jev Ultrafast | 0.1.0 @ 1231850a0bf1a0c0341fe408ef1668dbbfdfac46 | isolated source checkout |
| AXe | 1.8.0 | pinned release archive |
| Maestro | 2.6.1, Java 21 | installed CLI |
| XcodeBuildMCP | 2.7.0 | installed CLI |
| ios-simulator-mcp | 2.1.0 | expanded native readiness screen |
| Mobile MCP | 1.0.4; device agent 0.0.26 | expanded native readiness screen |
| fb-idb | 1.1.7 | isolated experiment virtual environment |
| Chromium | 151.0.7922.34 | dedicated experiment browser |
| Codex | 0.155.1, gpt-6-astra, medium reasoning | agent run metadata |
| Ternary Bonsai 2 27B PTQ1_0 | revision 6ed5e12bf84b7a63069882c91dd9e9218647d17b, SHA-256 53107f530aa52eb00912263ab1ee29bd199261c87cd7b4ad4ca1318c1fe33ee3 | pinned model artifact |
| Prism llama.cpp | 0.2.0-dev build 10709 @ 9a9394a895b96003ca842a6041cb28ac49a108f7, archive SHA-256 f9cdf245fb7b832f1996dd776b321d4ae1f23b6d88c380100f636742c3a980ff | pinned runtime artifact |
| Node.js app/build | 24.21.0 | experiment environment |
| npm | 11.19.1 | experiment environment |
| Node.js controller | 26.9.0 | initial measurement controller |
| zod | 3.25.76 | experiment package lock |
| Wrangler | 4.135.0 | site package lock |

</div>

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
