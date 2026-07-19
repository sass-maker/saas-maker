Build a small batch of reviewable marketing ideas from /Users/assistant/Desktop/fleet/saas-maker.

Style:
- Be very concise. Report only ideas created, skipped projects, failures.
- Use agents heavily for independent project-specific research/copy drafts when useful, then Codex consolidates into Marketing Queue ideas.

Rules:
- Do not post publicly, send emails, publish blogs, deploy, commit, push, or touch secrets/env/cloud credentials.
- Marketing Queue is the system of record. Repo docs are optional only when an existing task asks for docs.
- Prefer AI-video-first ideas for tiktok, instagram_reels, youtube_shorts. Avoid LinkedIn unless Sarthak asks.
- Avoid generic AI hype phrases.

Flow:
1. Run `node /Users/assistant/Desktop/fleet/fleet-ops/scripts/validate-marketing-program.mjs`; if validation fails, stop without queue writes.
2. Read `/Users/assistant/Desktop/fleet/fleet-ops/config/marketing-program.json`, then run `pnpm symphony --json --no-cache` and dedupe against open marketing/product tasks.
3. Consider only the registry `focusSet`, in its declared order. Do not substitute Foundry tier, stale prompt priorities, aliases, or model judgment for registry focus. Historical aliases resolve to their registry canonical slug.
4. Generate only when the aggregate snapshot is available, review debt is below the registry ceilings, and the focus project lacks a recent experiment. Otherwise report the review or recovery action and write nothing.
5. Inspect visible product/README enough to ground the idea.
6. Create a bounded batch of SaaS Maker Marketing Queue ideas via API-first workflow. Include canonical project_slug, channel, status=generated, source_type, title, hook, body, CTA.
7. Reel bodies need scene script, shot list, voiceover, captions, AI asset prompts, edit notes, first-frame hook.
8. If writeback fails, output exact retry payloads without secrets.

Output:
- Very concise: created ideas, skipped projects, writeback failures.
