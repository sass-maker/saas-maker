# SaaS Maker Project Status

## Why / What

SaaS Maker is the public product directory, the small shared feedback layer
used by selected products, and the home of backend-free SaaS Maker UI packages.
It exists to make the portfolio discoverable, provide one consistent way to
collect and review customer feedback, and package reusable public-facing
components without pulling product code into Foundry.

It is not the Fleet control plane. SaaS Maker's owner-local `catalog/projects.json`
is the single source for project and repository classifications. Site Health
reads its generated compatibility view and owns portfolio health. SaaS Maker Tooling owns shared
automation and agent skills under `tooling/`. Drank, Reel Pipeline, PSI Swarm, Mobile Dev
Cockpit, CodeVetter, and App Health remain independent repositories.

## Dependencies

- Owner-local `catalog/projects.json`, projected into
  `catalog/generated/public.json` before a directory release.
- Cloudflare Workers, D1, and R2 for the feedback API and image uploads.
- better-auth for the private inbox.
- React as the peer runtime for @saas-maker/feedback.
- React as the peer runtime for the AI Chat Footer and Portfolio Project Strip.

## Timeline

- **2026-10-03 — Agent workspace tooling implemented locally (#179).**
  Added a dependency-free CLI for linked writer worktrees, shared-store frozen
  pinned-pnpm installs, owner/task/heartbeat records, concurrency and disk
  admission limits, reversible close receipts, and dry-run legacy inventory.
  Fleet and managed-workspace instructions route agents through the helper.
  Focused lifecycle/concurrency tests and an isolated two-worktree offline
  install/isolation/recovery smoke passed; tooling validation passed.
  Source remains uncommitted/unpushed; no deployment or legacy-folder deletion.

- **2026-10-02 — Launchdesk Code Market and FutureStack account continuation.**
  Code Market owner Google sign-in opened its free digest form; all 15
  original public-URL products were acknowledged and saved in the owner
  dashboard for October 9-13. All offered public listing URLs return 404,
  so these remain queued. FutureStack accepted ContextDaddy and AliveVille
  for review within 48 hours; its owner page confirms both Pending and zero
  live. Open Historia received an existing-pending duplicate response,
  without a matching owner record; its existing identity stays unknown.
  Followed the approved FiveTaco account-confirmation email link, which
  redirected home without exposing verification status; ContextDaddy's
  public search remains empty. Appended 36 evidence rows preserving 2861
  prior rows; private receipts and continue-summary are in Fleet Ops.
  No payment, reciprocal badge, new outreach, commit, push or deploy.
  Firsto and BAI confirmations remain pending. Coverage refreshed and
  checked; zero new verified live listings.

- **2026-10-02 — Launchdesk account unlocks and FiveTaco review intake.**
  Owner approved PitchWall and FiveTaco terms/free submissions. FiveTaco
  acknowledged all 15 original public-URL products for free manual review;
  no payment, badge, ratings or public-live claims. PitchWall sign-in worked,
  but mandatory profile changes did not persist and the expected public
  profile returned 404. Flowtools opened after Google sign-in; ContextDaddy
  Submit lacked acknowledgement, so storage stays indeterminate.
  SubmitMatic and Startup Benchmarks sign-ins exposed mandatory homepage
  badges. ufind and ConfettiSaaS free publication also require badges;
  Firsto has a separate agreement gate and roughly 180-day free queue,
  while 10words needs owner credential creation. Appended 23 evidence rows
  (15 submitted, seven blocked, one indeterminate), preserving all prior
  rows. All 15 FiveTaco receipts are also corroborated by provider emails.
  A further 22 evidence rows record those email receipts, the still-open
  High Signal PR, three unchanged AISO queues, and prepared badge/account
  gates. Firsto agreement and BAI OAuth-app confirmations are pending.
  Receipts and account-gates-push summary remain private in Fleet Ops.
  Public coverage regenerated and checked; zero new verified live listings.

- **2026-10-02 — Launchdesk review follow-up and provider corrections.**
  Verified Meme Lab's public AISO category is now Search & Knowledge. AISO
  confirmed Motion Body Game's Freemium value was removed; unspecified pricing
  and held-prototype disclosure are saved, with publication held until a public
  build exists. High Signal PR #983 remains open with submission CI passed;
  awesome-mac #3041 and awesome-ai-tools #2250 are also open. All 16 confirmed
  Viesearch listing URLs still return 404. AI Hunter still fails TLS hostname
  validation; AI Valley's bounded ContextDaddy retry still reports a send error,
  storage unknown. AISO searches found no MentionPilot or gateway listing;
  Open Historia's fresh verification was interrupted by browser disconnection.
  Appended 39 receipt-bearing rows, preserving 2777 existing records
  (2816 total). Remaining provider, release and owner-decision gates
  are documented in private Fleet Ops `final-follow-up.md`; full distribution
  remains incomplete. No new public submission acknowledged, payment, bypass,
  additional email, commit/push or production deployment in this follow-up.

- **2026-10-02 — Fleet design workflow v2 released (#172, PR #176).**
  Published `94fe406e117f7fe6f34031a54c865c5ce3d62dfc` from an isolated
  current-main branch. Direction previews require attributable owner selection;
  separate preflight and completion checks validate rendered review evidence.
  Slop reports are required at direction, iteration and final stages while
  scores stay advisory. Landing/app inventory, paired previews, a shared system
  and the real CTA/onboarding/first-value path are required where applicable.
  The output contract requires visible results and concrete fixes. Preserved
  upstream native macOS evidence support. All 332 tooling tests (60 focused
  design tests), 25 native contract tests and relevant validators passed; the
  exact merged commit passed CI, Tooling CI and Docs. Installed tooling and skill
  discovery match the published source. Reviewed and trusted only the Fleet
  design reminder through native Codex `/hooks`; a fresh read-only session
  received the routing context and replied OK with no tools. Receipt checks
  still validate recorded evidence when invoked; they do not enforce tool
  timing, establish pixel-level quality or imply owner acceptance. Historical
  receipts and unrelated local work are preserved. No product UI, production
  dependency, deployment or migration changed.

- **2026-10-02 — Launchdesk wave-3 approved publication and confirmations.**
  Published High Signal's three-line contribution as
  `punkpeye/awesome-remote-mcp-servers` PR #983 from the owner public fork,
  commit `98721485b325126e54770a07b80fc8d85af6e5c3`; submission CI passed.
  PR remains open for maintainer review. Sent the owner-approved AISO correction
  draft to its maintainer and verified Gmail SENT; Meme Lab's live page still
  shows Image Generation, so category and Motion pricing corrections remain
  provider-pending. Found forwarded Viesearch confirmations in Gmail spam and
  completed CodeVetter plus all 15 remaining resolving-URL candidates on the
  free plan. Every final acknowledgement says the submission is now in the
  review queue; all 16 offered public listings return 404, so none are live.
  Saved receipts/screenshots and appended 34 ledger rows, preserving the prior
  2,743 records (2,777 total). Canonical catalog unchanged by this continuation.
  Remaining provider/account/paid/reciprocal gates remain open. No payment,
  production configuration change or deployment. Private receipts and latest
  continuation retained in Fleet Ops `launchdesk-wave3-2026-10-02/`.

- **2026-10-02 — Launchdesk wave-3 account continuation.** Glama account
  creation completed using the owner-authorized AgentMail inbox. Submitted the
  High Signal hosted endpoint for ChatGPT Connections; the UI acknowledged
  “Your server has been submitted for review”, followed by approval. The public
  High Signal connector page and score badge both return HTTP 200; anonymous MCP
  initialize and all six read-only tool definitions also returned HTTP 200.
  Glama reports “Not tested”; ownership verification is optional for the listing
  and badge but required to manage health checks. A three-line curated-list patch
  is prepared locally; publication awaits explicit commit/push authorization. Viesearch rejected
  AgentMail as disposable or banned; the owner approved its submission terms and
  supplied a business inbox. CodeVetter's free plan was selected successfully,
  pending fresh email confirmation; its offered public listing still returns
  404. The remaining serial batch waits on confirmation. ContextDaddy's Active
  Search Results lookup found no result, retaining its earlier acknowledgement.
  After the cooldown, AISO acknowledged MentionPilot, Motion Body Game and
  ChatGPT Connections into its free review queue. Motion's copy discloses the
  held prototype; AISO auto-selected Freemium from an unset optional field.
  A Gmail correction draft for that pricing and Meme Lab's inaccurate Image
  Generation category is saved, unsent, awaiting owner authorization. Ten new
  evidence-bearing ledger rows preserve the previous 2,733 records; no new AISO
  listing was verified live. No payment, commit, push or deployment.

- **2026-10-02 — Launchdesk wave-3 takeover (campaign
  `launchdesk-wave3-2026-10-02`), partially blocked.** Reconciled the current
  private ledger at 2,708 rows and appended 25 evidence-bearing rows, preserving
  all earlier records. Newly verified public listings: ContextDaddy and Meme Lab
  on AISO, plus Motion in `dkhamsing/open-source-ios-apps` after PR #2396 merged;
  AliveVille's existing AISO listing was re-fetched. All four live pairs have
  resolving public listing URLs and inspected project identity. No new submission
  was acknowledged in this pass. MentionPilot's free AISO retry still reports a
  submission limit; Motion and ChatGPT Connections were deferred without another
  POST. Motion remains a held prototype, and Meme Lab retrieves existing memes.
  AI Hunter's submission page fails TLS hostname validation, blocking all seven
  AI candidates without bypass; AI Valley still reports a submission error for
  ContextDaddy, with storage unknown, so six further retries were deferred.
  Open Historia's AISO acknowledgement remains submitted, with no public listing
  verified; StartFast's public ContextDaddy search also found no listing.
  AgentMail owner login and access to the campaign inbox succeeded. The earlier
  CodeVetter/Viesearch confirmation email was found, but its confirmation link
  returns 404; confirmation and current queue status remain unverified. Owner
  authorized Glama account creation; name/email setup is prepared, but CAPTCHA
  and terms acceptance remain pending. Chrome disconnected before further work.
  Existing awesome-mac #3041 and awesome-ai-tools #2250 remain open; no PR was
  created or changed. Private receipts and continuation summary are retained at
  Fleet Ops `growth-campaigns/launchdesk-wave3-2026-10-02/`; refreshed public
  coverage uses the existing projector, which omits hidden projects and blocker
  states and retains historical submitted/queued coverage. Remaining owner
  gates are open; no account-gated destination was submitted, payment made,
  reciprocal badge added, or production deployment performed.

- **2026-10-02 — Launch submission wave 2 (campaign
  `launchdesk-wave2-2026-10-02`).** Owner direction: submit every catalog
  project regardless of completeness or shareability flag. First pass covered
  the nine ledger-uncovered projects with live URLs (114 provider-
  acknowledged submissions across 14 destinations); second pass expanded to
  all remaining catalog projects and submitted the six additional ones whose
  URLs actually resolve — chatgpt-connections, ios-landings, ph-catalog,
  field-track, war-chest, unified-portfolio (49 more confirmed pairs,
  including chatgpt-connections on all AI/developer destinations and Dynamite
  id 3426). Blocked: startup-plug (Typeform closed), flowtools (login wall).
  Skipped honestly: fleet-social (Cloudflare Access login wall), 12 domains
  that fail DNS resolution, and projects with no deployed URL (human-v2,
  site-health, reel-pipeline, mobile-dev-cockpit, companion-robot,
  forecast-lab, verified-bases, slow-serp, shoulders, scale, digital-life).
  No listing proven live; provider acknowledgement ≠ publication. Ledger:
  `tooling/config/directory-submissions/submissions.json` (gitignored, 660
  rows); receipts at Fleet Ops
  `growth-campaigns/launchdesk-wave2-2026-10-02/`; public projection
  regenerated in `launch-coverage.json`.

- **2026-10-02 — Wave-2 agent expansion: five parallel agents probed ~110
  more launchdesk destinations.** 80 net-new provider-acknowledged pairs
  across eight additional destinations — siteswebdirectory.com ×15 (phpLD,
  "Link submitted and awaiting approval"), startupstash.com ×15 (Typeform),
  indiehacker.tools ×15 (Tally), aitools.inc ×7 (Typeform),
  aitoolsdirectory.com ×7 (Paperform), saasaitools.com ×7 (Fluent Forms),
  theaigeneration.com ×7 (Google Form), library.phygital.plus ×7
  (Softr/Airtable). Everything else verified gated — login walls,
  reciprocal-badge requirements, Cloudflare/Turnstile, reCAPTCHA, paid-only,
  geo-blocks, dead sites — recorded blocked/skipped in the ledger with
  per-destination evidence. Disclosed artifacts: one stray placeholder test
  row in siteswebdirectory's review queue and one debug probe row in
  saasaitools' queue (both will fail review). aitoolnet.com was WAF-blocked
  (403 on free-tier POST). Campaign submitted total: 243 pairs across 23
  destinations. Agent JSONL evidence merged into
  `receipts/agent-batches.jsonl`.

- **2026-10-02 — Wave-2 tail pass (agents F+G, 58 more destinations) plus
  curated-list PRs.** 59 net-new acknowledged pairs: indiehustles.com ×15,
  startfa.st ×15, findthatsoftware.com ×10, ainav.cn ×7, waildworld.com ×7,
  aisotools.com ×3, alphadigits.com ×1, and PR #2396 adding Motion to
  dkhamsing/open-source-ios-apps. Everything else gated as before (logins,
  CAPTCHA/Turnstile, reciprocal links, paid-only). punkpeye/
  awesome-remote-mcp-servers is blocked on a Glama connector listing, which
  needs a Glama account. ContextDaddy is already covered on both jaywcjlove
  lists (open PR #3041 on awesome-mac; listed on awesome-swift-macos-apps);
  mentionpilot and chatgpt-connections are inside open PR #2250 on
  mahseema/awesome-ai-tools. Campaign total: 307 submitted pairs + 1
  verified live listing (aisotools.com/tool/aliveville — auto-generated
  claimable page found via a 409 duplicate) across 31 destinations for 15
  projects. aisotools rate-limited three projects (motion, mentionpilot,
  chatgpt-connections) — re-attempt in a later wave; "Motion" needs a
  distinct display name there (motion.com collision). Disclosed: ainav.cn
  rows carry sites' own page titles (auto-fill overwrites the name field);
  one indiehustles test click reached a Stripe checkout — no payment made,
  all real rows used the $0 plan.

- **2026-09-26 — Launchdesk research backlog burn-down continued.** New
  `playbook-research` batches covered DR 48 through DR 32 of the
  `needs-research` queue: ~70 new per-platform playbooks this cycle plus
  earlier batches, each appended as a `playbook-research` claim in
  `launchdesk.json` without touching prior source claims. New quarantines:
  `bootstrappers.io` (placeholder), `collaborizm.com` (repurposed to a
  Substack pointer), `yourstack.com` (offline since ~2022), joining earlier
  `in.pcmag.com`, `designernews.co`, `vator.tv`, `valuer.ai`. Pay-to-list
  surfaces documented honestly (`nextbigwhat.com` $39–$79, `startups.fm`
  $49, `saashunt.best` auction slots, `press.farm` $279/yr); gated or
  unverifiable flows marked `conditional`/`unknown`. Changes uncommitted.

- **2026-09-25 — Launchkit shipped: free agent-executable launch toolkit.**
  `tooling/launchkit/` (product brief, truthful run planner, evidence tracker,
  run prompt, report script) plus 330 researched per-platform submission
  playbooks at `apps/showcase/src/data/launchdesk-playbooks/`, rendered
  publicly at `/launchdesk/<domain>` with JSON twins, a `/launchkit` page,
  `/launchkit.json` manifest, `/launchdesk-playbooks.json` index, and llms.txt
  entries. launchdesk.json grew to 1,163 destinations (+32 found auditing
  launchrepo.dev). Playbooks carry `grade: "researched"` — assembled from
  cited public pages, never claimed as observed submissions. Tracked in #144.

- **2026-09-19 — PH Catalog promoted without absorbing its code:**
  Registered PH Catalog as a canonical active, bounded finishing project while
  preserving `ph-catalog` as its independent Python/DuckDB repository and local
  data owner. SaaS Maker now publishes the privacy-safe synthetic-demo profile
  and may use a public repository as the canonical destination for a maintained,
  intentionally undeployed project. The 63-project catalog, 40-identity public
  projection, 63 Site Health dossiers, 61 SaaS Maker tests, showcase build and
  PH Catalog's 88 tests pass. Tracked in #113; no PH source, catalogue data,
  dependency, cloud resource or hosted service moved into SaaS Maker.

- **2026-09-15 — Marketing and decision handoff adapters (local):**
  Added one Fleet marketing entrypoint with on-demand positioning, customer
  research, copy and launch references. Existing mobile-task-control and
  fleet-ops handoffs now link a concise, artifact-specific decision guide.
  Upstream revision links preserve access to the broader collections without
  installing their runtimes or duplicate skill sets. PRODUCT.md, design selection
  and external-action permissions remain authoritative. Tracked in #109;
  no application, dependency, connector, schedule or deployment added.

- **2026-09-12 — Minimum shareable variants:**
  Verified nine existing public variants and the existing notarized Anchor Mac
  download. Added public projection support for five owner-approved standalone
  experiments, with explicit public-repository verification and neutral scope
  descriptions. PH Catalog now has a published safe synthetic offline demo
  (f57cdba; 88 tests). The generated directory contains 38 shareable entries.
  External TestFlight access remains pending for Calorie, Setline and Kith;
  HeyPace and Nomad are proposed for deferral. No owner classification is
  silently changed by verification gaps.

- **2026-09-12 — Lossless catalog structure (local):**
  Grouped product fields into classification, purpose, lifecycle, sharing, owner
  notes, repositories, deployment and presentation. Preserved all 5,916 original
  leaf values, 59 product identities and 82 repository-review rows against a
  byte-for-byte backup; the public export is unchanged. Site Health reads a
  generated compatibility view. Maintenance writers now update the structured
  source and reject stale or lossy saves. No deployment or classification changes.

- **2026-09-12 — One editable portfolio catalog:**
  Moved the complete private source to `catalog/projects.json`, retaining all 59
  product records and the original 82-repository cohort. Site Health's former
  path is a symlink. Linked repositories inherit project classifications; the
  full table and public export are generated. Raw private data stays local and
  ignored by Git; public builds use the allowlisted projection only.

- **2026-09-09 — Scoped deploy-guard CI recognition:**
  Independent unconditional build/test steps can establish CI evidence beside
  optional jobs or steps. Conditional/error-tolerant validators, dependency-gated
  jobs, unsupported YAML inheritance and shell early exits remain rejected.
  Exact-source successful push requirements are unchanged. See #104 and
  `tooling/skills/fleet-deploy-guard/SKILL.md` for the supported source boundary.

- **2026-09-07 — Bounded acquisition and SEO research skills added locally:**
  Added Fleet-owned `web-extraction`, `media-acquisition`, and `seo-research`
  skills with explicit source selection, authorization boundaries, unavailable
  states, and evidence receipts. Scrapling and OpenSEO remain optional backends;
  no packages, browsers, MCP servers, credentials, or provider projects were
  installed or connected. The existing technical `seo-audit` and product-local
  ingestion pipelines remain authoritative. Tracked in #103; no deployment or
  publication ran.

- **2026-09-01 — Fleet-wide Clarity health skill:** Added the discoverable
  `clarity-fleet-health` skill with separate credential-free source, cached
  health, explicit live refresh, and focused MCP investigation modes. Its first
  safe run accounted for all 56 canonical identities: 56 distinct project IDs,
  every declared source claim verified, and no blocking source findings. Site
  Health reported 26 eligible current products not yet measured, six current
  intentional unwired boundaries, and 24 inactive retained identities. No
  token lookup, Microsoft request, deployment, or provider mutation ran.

- **2026-09-01 — Fleet rollout decisions and Clarity source closure:** Recorded
  Starboard, High Signal, and Open Historia as the second shared web-landing
  adoption batch; confirmed the no-license UI path uses Preline or another
  maintained free upstream; and completed the five remaining dedicated Clarity
  projects and source integrations. The credential-free registry audit now
  verifies 56 distinct IDs across 56 products with no blocking findings.
  Production deployment and live verification remain separate receipts.
- **2026-09-01 — Unified footer composition repaired locally:** Updated the
  hosted Ask AI loader to compose with a project strip that mounts later,
  removed the obsolete Fleet-only composition opt-outs from active consumers,
  and regenerated Calorie's checked-in factory output. The shared-package
  checks pass with 29 tests, the 65-page showcase build passes, and the delayed
  loader plus a controlled 40-identity built-document harness render exactly
  one shared extension without the extension widening the document at 390,
  768, and 1440 px. Existing product-specific responsive receipts remain the
  authority for the host pages themselves. Protein Index remains the one
  source exception because its retired repository requires explicit
  reactivation before edits. No deployment or package publication ran. Refs
  #76.
- **2026-08-31 — Portfolio-strip fallback synchronized:** Regenerated the
  backend-free package's bundled public-project fallback from the checked-in
  canonical public projection, adding High Signal Podcasts and refreshing three
  changed product descriptions. Both shared-package checks and the public
  directory build pass. No npm publication or deployment ran.
- **2026-08-26 — Repository publication dogfood:** Extended public
  project profiles with a lazy, read-only IssuePages publication when the
  privacy-safe catalog exposes a validated public GitHub repository. Profiles
  without public source remain unchanged. The rollout is tracked in GitHub issue
  #79.
- **2026-08-25 — Shared AI footer simplified and released:** Replaced the
  studio discovery rail and project ticker with a compact, host-neutral utility
  dock. Kept visible labels and 44px actions, added recognisable colour to all
  five provider icons, and made each action open a pre-filled AI conversation
  in a new tab. The hosted loader now removes the legacy project strip by
  default while retaining `data-compose="false"` as a migration escape hatch,
  and the shared landing template loads only the AI footer. Released feature
  commit `0bc7aed1` through Pages deployment
  `b7be0170-45b8-4878-a614-3fd446dd1c6c`; exact-SHA CI passed, production smoke
  passed 4/4, and cache-busted live checks confirmed the new loader contract.
  The shared package source changed but no npm package publication ran.

- **2026-08-25 — Studio identity and shared public footer released:** Published
  the canonical founder-led studio thesis at `/studio` with matching Markdown,
  homepage, `llms.txt`, `/api/ai`, metadata, and distinct Person, Organization,
  and WebSite JSON-LD projections. Moved representative product evidence ahead
  of the operating principles, exposed direct product and source links, aligned
  expanded project evidence to the directory column grid, and replaced the
  letter-mark AI footer with labelled provider icons and a structured studio
  discovery rail. Released feature commit `99bfbf26` through Pages deployment
  `62dccdc0-d6e0-4b54-9779-00d0a3fb6e83`; production smoke passed 4/4, live
  visual checks passed at 390/768/1440 with no overflow or console errors, and
  the agent-index audit passed S-tier at 100%. The shared package source changed
  but no npm package publication ran.

- **2026-08-24 — Public project profiles expanded:** Added one generated HTML
  and Markdown profile for each of the 53 non-directory identities, while SaaS
  Maker remains canonical at `/`. Every profile leads with a reviewed
  first-person maker note, then exposes privacy-safe product anatomy and public
  evidence. `/projects`, sitemap, JSON, and agent discovery share the same
  schema-v4 projection. `/p/saas-maker` redirects remain intact. No deployment
  or npm publication ran.

- **2026-08-23 — Public interior theme unified:** Applied the homepage's
  limestone-and-steel workshop system to Ideas, Tools, Learnings, and the
  learning article; simplified navigation to Products, Ideas, Tools, Learnings,
  and GitHub; and removed Package from shared navigation while retaining its
  homepage section. The Ideas UI now omits the 92 `starterstory` entries and
  shows 48 curated ideas, while `/ideas.json` retains all 140 source records.
  The package remains unpublished; this release changes only the public site.

- **2026-08-23 — Ideas absorbed into SaaS Maker:** Added `/ideas` as a native
  scored catalog with the preserved 140-item dataset, filters, sorting,
  responsive comparison, JSON, Markdown, sitemap, and agent discovery. Removed
  `saas-ideas` from Site Health's canonical project identities and regenerated
  the public directory at 57 identities. The retired repository remains only
  as source history. Released feature commit `11084b6a` through Pages deployment
  `1ea12d31-4abf-42f6-9ffe-eb117f4ae75d`; production smoke passed 4/4 and the
  HTML, JSON, and Markdown routes were verified on `sassmaker.com`. No DNS
  action ran.

- **2026-08-23 — Redundant workspace packages removed:** Removed the private
  `@saas-maker/ui` package after switching its only consumer to the dashboard's
  existing local components. Removed the duplicate Astro login overlay and use
  the dashboard's native `/` and `/login` routes. Removed the Blume app and its
  missing Pages target while retaining checked-in Markdown docs and link
  validation. No deployment, migration, DNS, or npm action ran.

- **2026-08-23 — Shared tooling consolidated:** Imported the complete public
  Workflows and Skills history under `tooling/`, moved reusable GitHub workflow
  entrypoints to the repository root, and added human and JSON capability
  directories at `/tools` and `/tools.json`. Callers resolve one SaaS Maker
  source; predecessor archival is verified separately after cutover.

- **2026-08-22 — Homepage and directory roles separated:** Reduced the public
  homepage to four products in focus, one complete-directory gateway, the
  current learning entry, and SaaS Maker's package surfaces. Removed the
  repeated maintained/past catalogs and SaaS Maker's self-embedded portfolio
  strip; `/projects` remains the sole complete 58-identity register, with the
  same boundary reflected in the agent-readable homepage.
- **2026-08-22 — Complete directory distilled:** Replaced 58 repeated,
  full-height anatomy panels with compact specimen rows. Purpose, form,
  platforms, prominent tools, and destination remain visible; public links,
  deployment evidence, and retained Git bounds use accessible native
  disclosures. Wide layouts label columns once per lifecycle group, while
  stacked layouts restore local labels for context.
- **2026-08-22 — Complete Fleet directory published:** Expanded the public,
  privacy-filtered projection from the maintained subset to all 58 retained
  Fleet identities. The new `/projects` register separates current,
  supporting/parked, and past work; exposes public destinations, deployment
  classification, platforms, curated technology, and first/latest retained Git
  commit dates; and keeps the HTML, JSON, Markdown, sitemap, and agent surfaces
  aligned without runtime access to Site Health.
- **2026-08-22 — Feedback agent contract deployed:** Applied D1 migration
  `0025` (both preserved feedback rows kept), deployed `saasmaker-api` and
  `saasmaker-dashboard` at `c5d3e845`, and attached `app.sassmaker.com` as a
  Worker custom domain. The Anime List consumer merge is still blocked.
  `@saas-maker/feedback` is published on npm at `0.4.0` (4 versions).
- **2026-08-22 — Inbox sign-in is down; package docs host is missing:**
  `saasmaker-dashboard` carries no Worker secrets, so every `/api/auth/*` route
  returns 500 — better-auth 1.6.30 (bumped in `b9b5858a`) refuses to run on its
  default secret instead of warning. `BETTER_AUTH_SECRET`, `AUTH_GOOGLE_ID` and
  `AUTH_GOOGLE_SECRET` all need attaching; `pnpm deploy:cockpit` now blocks
  while any is absent. Separately, Pages project `saas-maker-packages` does not
  exist, so `saas-maker-packages.pages.dev` has no DNS and the feedback package
  documentation this file and README both advertise is unreachable. The public
  submit path, `api.sassmaker.com`, and the npm package are unaffected.
- **2026-08-22 — Standalone catalog boundary repaired:** Repointed public
  catalog synchronization to Site Health's canonical `projects.json`, retained
  the checked-in privacy-filtered projection for runtime use, and repointed the
  deploy guard to Workflows and Skills. No deployment or package publication
  ran.
- **2026-08-21 — Shared UI packages moved out of Foundry:** Imported
  `@saas-maker/ai-chat-footer` and `@saas-maker/portfolio-project-strip` with
  their component histories, added them to the SaaS Maker workspace and CI,
  and changed Portfolio Project Strip generation to consume SaaS Maker's
  checked-in 31-product public catalog projection. No npm publication or
  deployment ran.
- **2026-08-20 — Standalone ownership restored:** Restored SaaS Maker as the
  canonical public-directory and Feedback repository, synchronized the current
  directory and package sources from Fleet, and narrowed Feedback to public
  submission plus an authenticated private inbox and JSON agent contract.

- **2026-07-22 — Feedback package 0.3.0 prepared:** Versioned the current
  page-element anchoring release, restored React 18 and 19 peer compatibility,
  completed npm metadata and quickstart styling instructions, and verified the
  packed artifact in clean React 18 and React 19 consumers. Publishing remains
  a separate manual release action.
- **2026-07-22 — Public directory links hardened:** Fleet's public projection
  now omits unavailable roadmaps and private source links instead of rendering
  dead GitHub URLs. Human-readable and agent-readable directory surfaces both
  render only links that are actually public.
- **2026-07-21 — Narrow production deployed:** Directory, feedback API,
  feedback inbox, and Blume package docs are live. The directory consumes the
  synchronized Fleet projection, shows the five approved spotlight entries,
  and links package docs to their live Pages origin until the vanity domain is
  attached. Shared production smoke passes 9/9.
- **2026-07-21 — Production cutover authorized:** The narrowed source, four
  canonical Cloudflare targets, and manual deploy commands are the approved
  production state. Every deploy remains gated on clean, synchronized `main`,
  green CI for the exact commit, and live smoke verification of all surfaces.
- **2026-07-21 — Narrow-source cleanup completed locally:** Removed duplicated
  Fleet services, operational Cockpit pillars, non-feedback API routes, Droid,
  App Health copies, SDK/CLI, retired widgets, skills, host automation, and stale
  planning/docs source. The private Cockpit now contains only feedback and
  project-key surfaces. No production migration, deploy, DNS change, npm action,
  or repository archival was performed. Historical database tables remain
  untouched for a safe cutover.
- **2026-07-20 — Fleet Workspace boundary established:** Imported and reconciled
  Fleet Ops, Reel Pipeline, Content Factory, Drank, Mobile Dev Cockpit, PSI
  Swarm, registries, marketing operations, and host automation into
  sass-maker/fleet-workspace with component-native checks.

## Products

| Surface | Purpose |
| --- | --- |
| sassmaker.com | Public product directory |
| sassmaker.com/ideas | Scored product-idea decision ledger |
| api.sassmaker.com | Feedback and project-key API |
| app.sassmaker.com | Private feedback inbox |
| @saas-maker/feedback | Maintained public runtime package |
| @saas-maker/ai-chat-footer | Backend-free AI assistant footer package |
| @saas-maker/portfolio-project-strip | Backend-free portfolio discovery strip package |
| sassmaker.com/tools | Public directory for reusable skills, scripts, templates, and guides |
| tooling/ | Canonical credential-free shared automation source |

## Features (shipped)

- Canonical `/studio` identity with a personal position on AI, representative
  catalog-backed work, honest studio boundaries, selective commission path,
  matching Markdown/API projections, and entity-correct structured data.
- Curated public homepage with four products in focus and a single gateway to
  the complete register, without duplicating the 54-project directory.
- Deterministic 54-identity public projection consumed without private Fleet
  runtime access, with deny-by-default field validation.
- Expanded project profiles with a reviewed first-person maker note, public
  anatomy, canonical destinations, public repository evidence, matching
  Markdown, and honest local-only/no-public-destination states.
- Native `/ideas` catalog with 48 UI-curated ideas, decision filters, sortable
  desktop and mobile layouts, and complete 140-record JSON/Markdown archives;
  `starterstory` records remain in the archives but are not rendered in the UI.
- Searchable `/projects` register grouped by current, supporting/parked, and
  past work, with form-family and platform filters, mobile filter return,
  compact project anatomy, prominent tools, and native disclosures for public
  links, deployment context, and retained Git-history bounds.
- Matching human, JSON, Markdown, sitemap, and agent-readable directory
  surfaces.
- Public human and JSON indexes for reusable Fleet capabilities, backed by the
  same checked-in catalog validator used by operators and agents.
- Discoverable Clarity Fleet Health skill for complete source accounting,
  cached aggregate health, and explicit bounded live refresh through Site
  Health without copying credentials into shared tooling.
- Feedback submission for bug, feature, and general feedback.
- Optional screenshots and page-element anchoring.
- Private cross-product feedback inbox with type/status filters and status controls.
- Machine-readable OpenAPI contract for submission, inbox, detail, and status updates.
- Project-scoped agent tokens that default to read-only.
- Immutable status-change audit records with actor identity.
- Page URL, Pinpoint context, and screenshots stored as original customer evidence.
- Project-key creation and management.
- Repository-native package and service docs with link validation.
- Backend-free AI assistant links with provider-specific prompt handoff.
- Accessible portfolio discovery with bundled first paint and optional cached
  revalidation from sassmaker.com.

## Work queue

Open work is tracked only in [GitHub Issues](https://github.com/sass-maker/saas-maker/issues).
