# Growth Format Playbook

This playbook is for app marketing reels and slideshows. It is separate from
the kids-story creator MVP.

## Objective

Find a repeatable format that gets views consistently.

Run enough volume to get a signal before overfitting. The default experiment is
5-7 posts per day and a decision review after 35 posts. At that point, either
double down on the formats producing repeatable views or switch formats.

This does not change the repo's posting safety rule: autopost still requires an
accepted queue item, and operators should review drafts before publishing.

## Format Stack

| Format | Why It Works | Product CTA Rule |
| --- | --- | --- |
| Ranking system | Viewers want to know what takes the top spot. | Put the product around #2 or #3, not #1. |
| Sound sync | Beat-matched text and slide reveals create swipe momentum. | Make the product reveal hit on a beat; use platform-allowed sounds. |
| Tutorial | Useful teaching earns attention before the pitch. | Give real value first; product is the shortcut or finish. |
| Trend copy | Proven slideshow structures already have audience behavior. | Copy the mechanic, not protected assets, watermarks, or exact creative. |
| Before/after | The viewer wants the result gap closed. | Show the product as the mechanism behind the after state. |

## Experiment Rules

1. Ship 35 posts before declaring a format dead or proven.
2. Cover all five formats before adding new ones.
3. Keep each post tied to one format; do not mix every trick into one reel.
4. Track format id, hook, product placement, platform, views, average watch,
   completion, saves, shares, comments, and qualified clicks.
5. Double down only on repeatable view patterns, not one lucky spike.

## Format Notes

### Ranking System

- Rank a concrete niche list.
- Keep the #1 spot unresolved until the end.
- Place the product at #2 or #3 so it reads like a useful entry, not the whole
  ad.
- Good for: tools, habits, workflows, product comparisons, mistakes, upgrades.

### Sound Sync

- Pick the sound in the platform editor or another allowed source.
- Keep copyrighted lyric text out of repo drafts.
- Draft beat markers: `beat 1`, `beat 2`, `drop`, `final reveal`.
- Align text, transition, and product reveal to the beat.

### Tutorial

- Teach a real result, not a fake "use our app" walkthrough.
- Use the product only when it improves the process.
- The viewer should leave with useful knowledge even if they do not click.

### Trend Copy

- Copy the format shell: slide order, reveal pattern, joke structure, contrast.
- Replace subject, images, text, and context with original product-specific
  material.
- Do not reuse watermarked media or impersonate the original creator.

### Before/After

- Slide 1 creates the before-state tension.
- Slide 2 reveals the result.
- Optional slide 3 shows the product receipt or workflow.
- Keep this tight; the format loses power when over-explained.

## Reel Pipeline Integration

`src/growth-formats.js` is the structured taxonomy. Signal draft bundles now
include:

- `experimentPlan`: daily post volume and 35-post decision rule.
- `growthFormat`: per-variant format metadata.
- `formatExecution`: per-variant CTA placement, slide target, and production
  notes.

The renderer does not need to know these formats yet. For now they are draft
and review metadata.
