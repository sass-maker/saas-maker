# Creator MVP: Kids Story Reels

This is the validation path for kids story videos. It is a creator workflow,
not a software roadmap.

## Thesis

Before adding more automation, prove that parents and children will watch a
small set of gentle story videos. The pipeline should support reviewable drafts
and exports, but the first signal comes from taste, consistency, and trust.

Do not add new dashboards, agents, schedulers, custom renderers, auto-uploaders,
or analytics scripts for this experiment until the first three videos are made
and reviewed.

## MVP Stack

| Step | Tooling | Notes |
| --- | --- | --- |
| Source stories | Project Gutenberg, Wikisource, Sacred Texts, public-domain collections | Use public-domain base stories. Verify rights for the target region and do not copy modern retellings. |
| Script rewrite | ChatGPT or Claude | Rewrite for ages 4-8 with gentle language, short sentences, one moral, and a discussion question. |
| Visual style | Midjourney, DALL-E, Ideogram, Leonardo, or FLUX | Pick one picture-book style and keep it consistent across the first three videos. |
| Voice | Human voice first; ElevenLabs second | Warmth matters more than speed. If using ElevenLabs commercially, verify the active plan and input rights. |
| Editing | DaVinci Resolve or CapCut | Use image fades, slow pan/zoom, narration, soft music, and light sound effects. |
| Music/SFX | YouTube Audio Library | Prefer platform-provided licensed music/SFX before AI music. |
| Thumbnail/title | Canva | Keep thumbnails clear, calm, and honest. |
| Publishing | YouTube Studio | Set the audience correctly and follow made-for-kids quality guidance. |

## First Three Videos

1. `The Lion and the Mouse` — kindness and emotional warmth.
2. `The Tortoise and the Hare` — patience and discipline.
3. `The Crow and the Pitcher` — problem-solving.

If these three do not produce a watchable, parent-safe format, more automation
will only scale the wrong thing.

Production-ready manual packets live in `docs/creator-mvp-packs/`:

- `docs/creator-mvp-packs/lion-and-mouse.md`
- `docs/creator-mvp-packs/tortoise-and-hare.md`
- `docs/creator-mvp-packs/crow-and-pitcher.md`

## One Video Workflow

1. Pick one public-domain story and record the source/license note.
2. Rewrite a 500-800 word narration for ages 4-8.
3. Break the story into 10-14 scenes for a 5-8 minute video.
4. Generate one consistent 16:9 image per scene with no text in the image.
5. Record a warm human narration, or generate narration only after checking
   commercial rights and input ownership.
6. Edit with slow movement, gentle transitions, soft music, and limited SFX.
7. Create one honest thumbnail and title.
8. Upload through YouTube Studio, set the audience correctly, and do a final
   parent-trust review before publishing.

## Quality Bar

Before publishing, answer yes to all of these:

- Would a parent feel comfortable leaving this on for their kid?
- Is the story legally safe to adapt?
- Is the voice warm rather than generic?
- Are the visuals consistent and free of broken AI text?
- Is the edit calm rather than dopamine-driven?
- Is there a clear moral or discussion question?
- Is the title/thumbnail honest and not sensational?

## Repo Boundary

Reel Pipeline can help later with draft bundles, scene lists, asset manifests,
artifact storage, and review handoff. For this validation pass, it should not
be treated as the primary production system. Manual creation is the product
test. The packet files are the current build-out; they should be used in a
manual editor before any code path is expanded.

Useful official references:

- Project Gutenberg license: https://www.gutenberg.org/policy/license.html
- ElevenLabs text-to-speech usage notes: https://elevenlabs.io/docs/overview/capabilities/text-to-speech
- YouTube made-for-kids audience guidance: https://support.google.com/youtube/answer/9528076
- YouTube kids and family quality principles: https://support.google.com/youtube/answer/10774223
