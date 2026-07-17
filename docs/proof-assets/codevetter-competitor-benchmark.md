# CodeVetter competitor benchmark — design (CV6)

The moat. Today's benchmark scores CodeVetter vs *raw Claude* (a model
baseline). To become **the data source every "best AI code review" roundup has
to cite**, it must score CodeVetter against the **named competitors** LLMs
currently recommend, on the **same real agent-generated PRs**, with every raw
output published. This doc is the methodology; glm only scaffolds the results
page once the data exists.

Owner: me (design + harness) · Prereqs from user: competitor accounts/keys ·
Output feeds: `/ai-code-review-tools` page + expanded `/benchmark` dataset.

## Principle: honest, reproducible, form-factor-aware

The external analysis is explicit: *do not* write a 3,000-word article that
mysteriously ranks CodeVetter first. Run every tool on the same inputs, publish
raw outputs, **and state plainly where CodeVetter loses.** One credible page
showing a real missed regression beats twenty fabricated backlinks. Google
rewards original, people-first content; answer engines cite reproducible data.

## Competitor set

| Tool | Form factor | Access needed |
|---|---|---|
| **CodeRabbit** | PR-comment bot (GitHub app) | paid seat / trial |
| **Greptile** | PR-comment bot (GitHub app) | paid seat / trial |
| **Qodo** (Merge/PR-Agent) | PR-comment bot; OSS PR-Agent self-hostable | API key / OSS |
| **GitHub Copilot Code Review** | native GitHub review | Copilot subscription |
| **Semgrep** | static-analysis CI (rules, not LLM) | free tier (baseline/control) |
| **CodeVetter** | desktop workbench | ours |

Semgrep is included as a **non-LLM control** — it shows what a pure SAST tool
catches vs the LLM reviewers, which is itself a citable finding.

## Dataset

Reuse + extend the existing hand-labeled corpus (`benchmark/cases/`, 27 cases, 6
languages, 4 categories, each with `expected_findings`). For fairness across
PR-bots, each case is materialized as a **real pull request** in a public test
repo (`Codevetter/codevetter-benchmark`), one PR per case, so every tool reviews
identical diffs. Target **≥40 cases** for the competitor run (add 13+ new
real-agent bugs — pull from actual Claude Code/Cursor/Codex output, not
synthetic) so results are statistically less noisy than 27.

## Metrics (per tool, per case)

1. **Defects caught** — recall against `expected_findings` (a finding counts if
   it names the right defect at the right location; adjudicated by hand, rubric
   published).
2. **False positives** — flagged issues that aren't real defects (precision).
3. **Duplicate comments** — same defect reported >1×.
4. **Review latency** — wall-clock from PR-open (or CodeVetter run start) to
   review complete.
5. **Cost** — $ per review (API/seat cost amortized; note free tiers).
6. **Fix-verified** — does the tool verify a proposed fix actually resolves the
   defect (re-run / executable QA)? Most PR bots score 0 here; this is
   CodeVetter's differentiator — but report it as a *capability axis*, not a
   thumb on the scale.

## Scoring + fairness rules

- **Blind adjudication:** the human scorer maps each tool's raw comments to the
  expected-findings rubric without knowing which tool produced them (strip tool
  labels). Publish the rubric + every mapping decision.
- **Form-factor caveat, stated up front:** CodeVetter is a desktop workbench;
  CodeRabbit/Greptile/Copilot are PR-comment bots; Semgrep is SAST. They serve
  different workflows. The benchmark measures *defect-detection quality on
  identical diffs*, not "which product is best" — say so in the first paragraph.
- **Where CodeVetter loses:** a dedicated section. If a competitor catches
  something CodeVetter misses, it goes on the page verbatim. This candor is the
  credibility that gets the page cited.
- **Versioning:** record each tool's version/date; results are a snapshot
  (`datePublished`), re-runnable.

## Reproducibility (what ships public, CC0)

- The test repo with all case-PRs.
- A harness script that opens the PRs and collects each tool's output (where
  API-accessible; manual capture documented where not).
- Raw outputs per tool per case (JSON + the original comments).
- The adjudication rubric + scoring sheet.
- Extended `codevetter-benchmark-v2.json` with per-tool results + `Dataset`
  JSON-LD (CC0, `variableMeasured` lists the 6 metrics).

## Execution plan

- **[me]** finalize rubric, metric definitions, the 13+ new cases, harness design.
- **[user]** provision competitor access (CodeRabbit/Greptile/Qodo/Copilot
  trials or seats) — the one hard external dependency; note trials may suffice
  for a one-time snapshot.
- **[me + harness]** run the suite, capture raw outputs, adjudicate.
- **[glm]** build `/ai-code-review-tools` from the finished data: results table,
  methodology, per-tool honest notes, "where CodeVetter loses", reproduce steps,
  `Dataset` + `FAQPage` JSON-LD. Link from nav + `/benchmark` + all machine
  surfaces.

## Risks / honesty flags

- **Cost/access:** competitor seats cost money; a single-snapshot trial run is
  acceptable and cheaper — document that it's a snapshot.
- **ToS:** publishing competitor *outputs* for comparison/research is generally
  defensible, but keep it factual, non-derogatory, versioned, and offer a
  correction path ("tool authors: rerun and we'll update"). This doubles as the
  outreach hook (X4).
- **Noise:** 40 cases is still small — publish per-case results so readers judge,
  don't over-claim aggregate percentages.
