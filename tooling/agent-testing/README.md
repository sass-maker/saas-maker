# Local agent-testing benchmark runner

This directory contains the reusable, credential-free orchestration layer for
local application-agent benchmarks. Product repositories retain their own app
startup, seed/reset logic, journeys, selectors, defect toggles, correctness
oracles, and raw evidence.

The runner is deliberately not a UI automation framework. It invokes explicit
product-owned command arrays and measures whether independent verification
accepts the outcome. Playwright, Maestro, AXe, Jev, Stagehand, Browser Use,
model runtimes, browsers, and simulators remain product-scoped dependencies.

## Commands

```sh
node tooling/scripts/agent-testing.mjs validate --manifest path/to/benchmark.manifest.json
node tooling/scripts/agent-testing.mjs run \
  --manifest path/to/benchmark.manifest.json \
  --out path/to/new-results-directory
node tooling/scripts/agent-testing.mjs summarize --receipt path/to/receipt.json
```

`run` refuses a non-empty output directory. It writes `receipt.json`,
`summary.json`, and one directory per configured run. Cold runs execute before
warm runs. The product adapter decides what cold and warm mean by reading the
runner-provided variables listed below.

## Product adapter contract

A manifest is strict and versioned. Unknown fields, shell executables,
unbounded timeouts, and more than 100 runs per temperature are rejected before
execution. `workflow` and `verification` are required. Other phases are
optional.

Commands receive these non-secret runtime variables:

- `FLEET_AGENT_TEST_OUTPUT_ROOT`
- `FLEET_AGENT_TEST_RUN_DIR`
- `FLEET_AGENT_TEST_TEMPERATURE` (`cold`, `warm`, or `shared`)
- `FLEET_AGENT_TEST_ITERATION`

The runner inherits the caller's existing process environment but never writes
environment values, stdout, stderr, headers, cookies, or response bodies into a
receipt. A command can publish allowlisted numeric metrics and relative
artifact references on one stdout line:

```text
FLEET_AGENT_TEST_RESULT={"metrics":{"modelCalls":1,"modelMs":20},"artifacts":["evidence/final.png"]}
```

All other command output is discarded. Artifact content stays owned by the
calling product and is not copied into Fleet tooling. An artifact reference
must be relative and cannot traverse to a parent directory.

The runner treats these outcomes differently:

- workflow and verification pass: `passed`
- workflow passes but verification fails: `incorrect`
- another phase exits non-zero or emits invalid marked output: `failed`
- any phase exceeds its bound: `timed_out`

This distinction prevents a successful click sequence from being reported as
a correct application result.

## Measurements

The receipt records total and per-phase monotonic wall time. Adapters may add
setup, reset, readiness, observation, model, control, application-wait,
verification, token, image, spend, retry, and intervention metrics when the
underlying tool exposes them. Use `controlAndApplicationWaitMs` when a driver
cannot truthfully split control overhead from application waiting.

Correctness totals include seeded defects detected or missed and false alarms
when a product adapter reports them. The shared runner never infers those
values from a driver exit code; the product oracle owns that classification.

The summary reports the exact median and nearest-rank observed p95 of verified
passes. At fewer than 20 samples, observed p95 is effectively a maximum and is
explicitly labeled preliminary. A benchmark qualifies only when every
configured run executes, every run passes independent verification, setup and
teardown pass, and no manual intervention is reported. Adoption comparisons
and product-specific defect coverage remain decisions for the experiment
report, not claims made by this runner.

## Safety boundary

- Run only against local or disposable targets.
- Do not put credentials or environment values in manifests.
- Use command arrays; shell strings and shell executables are rejected.
- Keep every phase bounded. The runner terminates timed-out child process
  groups and does not retry them.
- Keep application assertions in the product repository. A generic runner
  cannot decide whether a financial value, account, or search result is right.
- Historical results are immutable evidence. Migrating an adapter does not
  convert old timings into shared-runner measurements.

The sanitized `fixtures/` directory demonstrates a good run and a deliberately
broken application oracle. It is test data, not a sample application framework.
