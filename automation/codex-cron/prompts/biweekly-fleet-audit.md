Run the weekly Active-AI product/design review from /Users/assistant/Desktop/fleet/saas-maker.

Style:
- Be very concise. Report only ranked findings, task changes, agents used, checks, blockers.
- Use other agents heavily for independent implementation tasks after selecting the work. Codex should coordinate, dedupe, verify, and fix obvious agent mistakes.

Priority lanes:
- P0: reader, swe-interview-prep, starboard, karte.
- P1: free-ai, significanthobbies, rolepatch.
- P2 watch: anime-list, looptv, email-manager, reel-pipeline.

Flow:
1. Read `foundry.projects.json`, `pnpm symphony --json --no-cache`, and README task logs. Dedupe before creating anything.
2. Inspect actual hosted/local UI for P0/P1 when possible. Use browser evidence/screenshots; state briefly if unavailable.
3. Rank products by 3-second value, simple copy, obvious CTA, trust, core-loop proof, mobile ergonomics, and differentiation.
4. Create at most 3 to 5 new tasks only if materially better than existing open work. Mark approval-sensitive tasks blocked_on_user=true.
5. For slam-dunk unblocked tasks, dispatch independent work to Symphony agents with modest parallelism. Do not change auth, data model, pricing, secrets, deps, deployments, or product direction.
6. Run the smallest relevant verification and capture screenshots for UI changes when possible.

Output:
- Very concise: backlog snapshot, ranked findings, tasks created/updated, agents used, checks, blockers.
- Keep ops noise out unless it changes product priority.
