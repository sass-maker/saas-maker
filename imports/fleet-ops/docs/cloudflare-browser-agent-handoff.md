# Cloudflare cleanup — browser-agent handoff (2026-07-18)

Self-contained. Goal: get the whole Cloudflare account to a clean state and
**verify** it. Do the audit AND the fixes AND confirm at the end.

## Access & source of truth
- CF dashboard account: **sarthakagrawal927@gmail.com** (single account).
- Intended tier + repo + deploy-kind + domains per product: the manifest
  `fleet-ops/config/projects.json` in the `fleet` repo (read it first — it lists
  all 43 live deployment units and each product's *intended* domain).
- Scope today: **18 Pages projects + 25 Workers = 43 units.**

## The 4 acceptance criteria (what "done" means)
1. **Green** — no failed builds; every custom domain resolves and serves 2xx
   (or an intentional non-2xx like an API worker with no root route).
2. **Git-connected** — every project is either CF-native git-connected OR has a
   working GitHub Actions deploy on push. (Both count. Do NOT CF-native-connect a
   project that already deploys via Actions — that double-pipelines it.)
3. **No duplicates** — no duplicate projects; no redundant/leftover custom domains.
4. **Right domain per product** — each product's assigned domain matches the
   manifest.

## Already done (do NOT redo)
- Deleted junk Pages projects: `today-little-log` and a duplicate `posttrainllm`.
- Removed phantom pending domains: `interview.sassmaker.com`,
  `anime.sassmaker.com`, `tv.sassmaker.com` (were dangling, no DNS).
- Removed the stray `tinygpt.sarthakagrawal.dev`; PostTrain now has only its
  canonical custom domains (`posttrainllm.com` and `www.posttrainllm.com`).
- `ideas.sassmaker.com` → **already 200/green** (CNAME → saas-ideas.pages.dev).
- `tinygpt` project stays named `tinygpt` **by decision** (cosmetic; the site is
  posttrainllm.com — do NOT rename it).

---

## TASK A — Fix the two failed builds (the real red)
Both `reader` and `email-manager` show **"Latest build failed."** Their code
builds cleanly and is in sync with `origin/main`, so it's a **Workers-Builds
environment/config** issue, not the code.
1. Workers & Pages → **`reader`** → **Builds/Deployments** → open the latest
   **failed build → View build log** → read the actual error.
2. Fix the cause in the build config (most likely one of: a missing **build
   variable/secret**, a wrong **build command**, or a failed **install** step).
   Re-run the build.
3. Repeat for **`email-manager`**.
4. **Accept:** latest build for each is green.
5. Paste the two build-log errors back to Sarthak regardless (useful even if you
   fix them).

## TASK B — Domains: verify, fix content, remove redundant
1. **Verify every custom domain** across all Pages + Workers resolves and serves
   2xx. Known non-2xx to resolve:
   - `api.sassmaker.com` → 404 at `/` is **expected** (API-only worker) — leave.
2. **Redundant domains** — for each project/worker, review its custom domains and
   remove any that are leftover/unintended or point to the wrong product.
   Cross-check every attached domain against the manifest's intended domain.
   (Flag anything ambiguous to Sarthak before deleting.)
3. **Right domain per product** — confirm each product serves on its manifest
   domain; fix any mismatch.
4. **Accept:** every custom domain is intended, resolves, and serves 2xx (or a
   deliberate exception).

## TASK C — Git connection
Current state (verify and complete):
- **CF-native git-connected (fine):** codevetter, anime-list, saas-maker-docs,
  swe-interview-prep, knowledgebase-landing, web-playables, saas-ideas.
- **Deploy via GitHub Actions on push (fine — leave as-is):** tinygpt, chess-9a0,
  materia, pace, drank, psi-swarm-web, research-papers, looptv, aliveville,
  and saas-maker-home.
- **Truly manual product surfaces:** none identified. The personal site
  (`sarthakagrawal`) remains an intentional direct-upload, non-product surface.
1. **Accept:** every project is CF-native-connected or Actions-deploying.

## TASK D — Duplicates & final verification
1. Confirm **no duplicate projects** and **no domain attached to two projects**.
2. Re-verify all 4 criteria and report a short pass/fail per criterion:
   - Green: any failed builds? any custom domain not serving?
   - Git-connected: any project with neither CF-git nor an Actions deploy?
   - No duplicates: any dup project/domain?
   - Right domain: any product on the wrong/missing domain?

## Report back
A short summary: what was red and is now fixed, the two build-log errors, any
domains removed, any items that need Sarthak's decision.
