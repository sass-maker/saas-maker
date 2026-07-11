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
1. Run `pnpm symphony --json --no-cache` and dedupe against open marketing/product tasks.
2. Prioritize P0: reader, swe-interview-prep, starboard, linkchat. Use P1 only for obvious activation/distribution angles.
3. Inspect visible product/README enough to ground the idea.
4. Create 3 to 7 SaaS Maker Marketing Queue ideas via API-first workflow. Include project_slug, channel, status=generated, source_type, title, hook, body, CTA.
5. Reel bodies need scene script, shot list, voiceover, captions, AI asset prompts, edit notes, first-frame hook.
6. If writeback fails, output exact retry payloads without secrets.

Output:
- Very concise: created ideas, skipped projects, writeback failures.

