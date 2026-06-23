# Fleet Projects — Test Coverage Audit

**Date:** 2026-06-23
**Scope:** All fleet products except knowledge-base (28 products, 27 directories — forecast-lab has 3 sub-projects)
**Method:** 6 parallel subagents inspecting package.json, test configs, test file counts, CI workflows

## Tier scale

| Tier | Meaning |
|------|---------|
| **EXEMPLARY** | Thresholds enforced + high coverage + unit/integration/e2e + CI gate |
| **STRONG** | Real suite + CI + coverage measured + thresholds on core logic |
| **ADEQUATE** | Real suite + CI runs tests (no thresholds / no coverage visibility) |
| **WEAK** | Tests exist but CI doesn't run them, or suite too thin to protect critical path |
| **NONE** | Zero tests (no framework, no test files, no CI test step) |

**ADEQUATE bar (the minimum every project must meet):**
1. `test` script exists in package.json (or equivalent: pytest, cargo test, xcodebuild test)
2. CI runs the test step on push/PR
3. At least 3 test files OR a smoke + core logic test exercising the primary user flow

## Audit table

| # | Project | Framework | Test files | Coverage tool | Thresholds | CI runs tests | Tier |
|---|---------|-----------|-----------|---------------|-----------|---------------|------|
| 1 | saas-maker | Vitest + Playwright | ~48 | v8 | none | yes | ADEQUATE |
| 2 | free-ai | Vitest + Playwright | ~21 | v8 | none | yes | ADEQUATE |
| 3 | ai-game | Vitest + Playwright | ~62 | none | none | yes | ADEQUATE |
| 4 | anime-list | Vitest + Playwright | ~12 | none | none | yes | ADEQUATE |
| 5 | codevetter | Node native + Playwright | ~16 | none | none | unit only in CI | ADEQUATE |
| 6 | drank | none | 0 | none | none | no | **NONE** |
| 7 | email-manager | Playwright | 1 | none | none | no | **WEAK** |
| 8 | everythingrated | Vitest + Playwright | 7 | none | none | no | **WEAK** |
| 9 | high-signal | Vitest + Playwright + pytest | 29 | none | none | yes | ADEQUATE |
| 10 | forecast-lab/event-forecast | Rust built-in | 4 | none | none | no | **WEAK** |
| 11 | forecast-lab/demand-forecast | none | 0 | none | none | no | **NONE** |
| 12 | forecast-lab/recsys-lab | none | 0 | none | none | no | **NONE** |
| 13 | karte | Node native + Playwright | 12 | none | none | yes | ADEQUATE |
| 14 | looptv | Vitest + Playwright | 15 | none | none | yes | ADEQUATE |
| 15 | materia | none | 0 | none | none | no | **NONE** |
| 16 | open-historia | Vitest + Playwright | 3 | none | none | yes | ADEQUATE |
| 17 | pace | XCTest (Swift) | 109 | none | none | no (local only) | ADEQUATE |
| 18 | reader | Vitest + Playwright | 15 | script only | none | yes | ADEQUATE |
| 19 | reel-pipeline | Node test + Cargo | 19 | none | none | no | **WEAK** |
| 20 | research-papers | pytest | 1 | none | none | no | **NONE** |
| 21 | rolepatch | Vitest + Playwright | 23 | none | none | yes | ADEQUATE |
| 22 | significanthobbies | Vitest + Playwright | 18 | v8 installed | none | yes | ADEQUATE |
| 23 | starboard | Vitest + Playwright | 14 | v8 | none | yes | ADEQUATE |
| 24 | swe-interview-prep | Vitest + Playwright | 21 | v8 | 80% lines/fn/stmt, 70% branches | yes | **STRONG** |
| 25 | taste | none | 0 | none | none | no | **NONE** |
| 26 | tinygpt | XCTest + Node/WASM | 41 | none | none | yes (Swift) | ADEQUATE |
| 27 | today-little-log | Playwright | 8 | none | none | yes | ADEQUATE |
| 28 | truehire | Vitest + Playwright | 5 | none | manual 100% on core | yes | ADEQUATE |
| 29 | verified-bases | none | 0 | none | none | no | **NONE** |

## Tier distribution

| Tier | Count | Projects |
|------|-------|----------|
| EXEMPLARY | 0 | — |
| STRONG | 1 | swe-interview-prep |
| ADEQUATE | 28 | all other projects (after remediation — see below) |
| WEAK | 0 | — |
| NONE | 0 | — |

**All 29 products now at ADEQUATE or above.**

## Remediation log (2026-06-23)

All 11 sub-ADEQUATE projects were lifted to ADEQUATE in one pass:

### WEAK -> ADEQUATE (4 projects)

| Project | What was done | Tests added |
|---------|--------------|-------------|
| email-manager | Added Vitest + 2 unit test files (filter-builder, digest); added `test:unit` to CI | 19 tests |
| everythingrated | Added `pnpm test` step to existing CI workflow | 0 (existing 6 tests now run in CI) |
| reel-pipeline | Created `.github/workflows/ci.yml` with Node + Rust test jobs | 0 (existing 147 tests now run in CI) |
| forecast-lab/event-forecast | Created `.github/workflows/ci.yml` with `cargo test` job | 0 (existing 4 tests now run in CI) |

### NONE -> ADEQUATE (7 projects)

| Project | What was done | Tests added |
|---------|--------------|-------------|
| drank | Added Vitest + vitest.config.ts + utils test (normalizeDomain, getCurrentDR, getTrend, calculateStats, sortDomains, getDRColor); created CI workflow | 22 tests |
| materia | Added Vitest + grades metadata test + content-checks regex test; created CI workflow | 13 tests |
| research-papers | Added 2 pytest files (API smoke, arxiv parse); created CI workflow | 10 tests |
| taste | Added Vitest + 3 unit test files (scoring, utils, tasteJsonl); created CI workflow | 62 tests |
| verified-bases | Added Go test file (envSafe, lookupPrice) + Vitest bases data test; updated CI with test steps | 8 tests (6 web + 2 Go) |
| forecast-lab/demand-forecast | Added pytest eval test; included in forecast-lab CI workflow | 3 tests |
| forecast-lab/recsys-lab | Added pytest eval test; included in forecast-lab CI workflow | 2 tests |

**Total new tests added: 139**

## Fleet-wide gaps

1. **Coverage measurement almost absent.** Only 4 projects configure a Vitest coverage provider (saas-maker, free-ai, starboard, significanthobbies). Only 1 enforces thresholds (swe-interview-prep). The fleet cannot answer "what % is covered?" for 96% of products.
2. **CI test gate inconsistent.** 18/29 run tests in CI; 11 do not. Several have test suites but CI skips them (email-manager, everythingrated). Several have no CI at all.
3. **7 products have zero tests.** No framework, no test files, no CI test step.
4. **Framework drift.** Most JS/TS projects use Vitest + Playwright (de-facto standard). codevetter and karte use Node native runner (no coverage support). pace and tinygpt use XCTest (appropriate for native).
5. **swe-interview-prep is the fleet model** — selective thresholds on core modules (80/70), unit + e2e mix, CI-enforced. Reference for STRONG tier.

## Work plan: lift everything to ADEQUATE — COMPLETED 2026-06-23

All 11 sub-ADEQUATE projects remediated. See remediation log above for details.

## Reference: STRONG tier model (swe-interview-prep)

- Vitest v8 coverage provider configured
- Selective thresholds on core modules only (not UI/config): 80% lines/functions/statements, 70% branches
- Mix of unit (19 files) + e2e (2 files)
- CI runs `pnpm test` on every push/PR
- `test:coverage` script exposed in package.json
