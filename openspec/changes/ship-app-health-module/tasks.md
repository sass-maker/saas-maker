## 1. Contract And Authenticated Ingest

- [x] 1.1 Add App Health SDK span builders that match the existing performance validation contract without a redundant project id
- [x] 1.2 Derive missing project identity from the authenticated API key while rejecting mismatches and preserving all validation
- [x] 1.3 Add API tests for omitted, matching, mismatched, invalid, sensitive, duplicate, and capped span batches
- [x] 1.4 Regenerate OpenAPI and SDK/CLI contract artifacts for the key-scoped input behavior

## 2. Node.js SDK

- [x] 2.1 Add a dependency-free bounded App Health client to `@saas-maker/sdk` with diagnostics, flush, close, timeout, and retry behavior
- [x] 2.2 Add Express-compatible middleware with framework route-template preference and privacy-safe fallback normalization
- [x] 2.3 Add Node unit, privacy, failure-isolation, shutdown, and packed-consumer tests
- [x] 2.4 Bump the prepared package version and verify `pnpm pack` without publishing

## 3. Go SDK

- [x] 3.1 Add the public `github.com/sass-maker/saas-maker/packages/app-health-go` module with key-only defaults and no external dependencies
- [x] 3.2 Add `net/http` middleware that preserves response and panic behavior while normalizing route templates
- [x] 3.3 Add Go unit, privacy, delivery, shutdown, race, vet, and clean-consumer tests

## 4. Focused Cockpit UI

- [x] 4.1 Extend route evidence with last-seen data and deterministic App Health state
- [x] 4.2 Add the authenticated `/fleet/app-health` workspace with summary cards, project/window filters, endpoint table, recent activity, and truthful empty/unavailable states
- [x] 4.3 Add navigation and links between App Health, advanced Speed, and installation guides
- [x] 4.4 Add component/data tests for populated, empty, unavailable, project-filtered, and health-state behavior

## 5. Human And Agent Documentation

- [x] 5.1 Add independently complete Node.js/Express and Go `net/http` installation guides using real package/module identities
- [x] 5.2 Add a machine-readable App Health manifest plus `llms.txt`, `/api/ai`, and Markdown discovery links on the public package-docs surface
- [x] 5.3 Update SDK index, docs navigation, README/AGENTS guidance, and canonical product status without duplicating facts
- [x] 5.4 Add a deterministic screenshot-only harness and check in desktop and narrow App Health screenshots with no production data

## 6. Validation And Release Readiness

- [ ] 6.1 Run focused API, SDK, Go, Cockpit, OpenAPI, docs, typecheck, lint, and build checks
- [x] 6.2 Run browser keyboard/responsive checks and compare the checked-in screenshots
- [ ] 6.3 Fetch current Cloudflare Worker references, validate generated bindings/config, run Wrangler dry-runs, and run the fleet deploy guard
- [ ] 6.4 Commit and push only after source checks pass, then verify exact-head GitHub CI

## 7. Explicit Production Actions

- [ ] 7.1 Obtain explicit approval before applying the ordered pending D1 migrations, then verify the remote migration ledger
- [ ] 7.2 Obtain explicit release approval before publishing the prepared Node package or creating a stable Go module tag
- [ ] 7.3 Deploy the authorized API, Cockpit, and package-docs surfaces and run production smoke plus an App Health canary
- [ ] 7.4 Archive this OpenSpec change only after every required production action is either completed or recorded as an explicit blocker
