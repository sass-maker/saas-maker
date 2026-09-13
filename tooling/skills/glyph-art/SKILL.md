---
name: glyph-art
description: Create archival, specimen, and object-collage treatments of an existing logo or glyph, with optional aligned-frame motion planning. Use for material-based logo art or glyph prompt packs, not logo redesign, UI styling, or ordinary texture fills.
---

# Glyph art

Turn an existing mark into a composition of discrete objects or negative space
without redesigning its silhouette. Distilled from an owner-supplied glyph
prompt pack; its particular pixel monogram is an example, not a default logo.

## Establish the mark and deliverable

- Use the supplied logo/reference and the requested output: prompts, stills,
  a series, or a motion plan. Prompt-only requests do not authorize generation.
- Inspect an available reference before describing geometry. If exact fidelity
  is requested without a usable reference, ask for the logo. A text-only concept
  is possible, but label its proportions as approximate.
- Record identity anchors: silhouette, stroke widths, corners, counters,
  disconnected pieces, orientation, and relative spacing. Preserve curves for
  curved marks; sharp 90-degree corners apply only to rectilinear marks.
- Default to a square canvas, centered mark at about 70% of frame height
  (source range 65–75%), unless the user specifies another composition.

## Compose

Read [references/material-presets.md](references/material-presets.md) for the
28 source-derived treatments. Select only those relevant to the product or
request. For angular marks, rectangular materials usually retain structure
more easily; organic objects may need denser placement at identity corners.

Choose an explicit construction mode:

- **Object placement:** separate objects trace strokes and modules, with
  visible background between objects. Do not apply a texture inside a mask.
- **Negative space:** surrounding material reveals the empty silhouette;
  preserve counters and avoid accidentally inverting foreground/background.
- **Contour alignment:** material edges reinforce the mark's defining outline.

Build each prompt from:

> Use the supplied mark as the geometry reference: [identity anchors].
> [Framing and scale]. Construct it through [mode] using [objects and placement].
> Preserve [critical gaps/corners/counters]. [Background, palette, imaging style].
> Keep separate objects and readable negative space. Do not warp the mark,
> introduce perspective, fill a solid logo mask with texture, or add unrelated
> branding, mockup scenery, or cinematic lighting.

The default treatment is a flat archival scan, specimen plate, or documentary
flat lay. Microscopy and radiography presets explicitly allow scientific glow,
transparency, refraction, or specimen gloss; do not contradict them with a
blanket ban on all glow. Avoid neon-sign styling and glossy 3D logo extrusion.
Tiny scientific labels are decorative unless factual labels were supplied;
do not present generated specimens or diagrams as scientific evidence.

## Generate and inspect, when requested

Use the available imagegen skill/tool for raster generation and edits, passing
the supplied reference through its supported image-reference mechanism. If
unavailable, provide prompts and report that no images were generated.

For an exploratory series, start with one representative proof before scaling
up unless the user explicitly requests the full batch. Inspect at thumbnail
and full size: recognisable silhouette, intact counters, distinct modules,
consistent scale, visible object separation, and no accidental extra symbols.
Correct lost geometry with a targeted reference-based edit rather than adding
more decoration. Preserve the original logo; generated artwork is not an exact
vector replacement. Report fidelity limitations honestly.

## Optional motion

Only plan or assemble a sequence when requested. The source suggests 12–24
frames, 0.12–0.18 seconds per frame, short dissolves or hard cuts, subtle paper
grain, and a global 103–108% zoom. Treat these as an energetic draft recipe,
not a mandatory or accessibility-certified playback setting.

Lock mark position and scale across source frames; apply any zoom consistently
to the whole sequence. Alternating high-contrast frames can flash: prefer a
slower/lower-contrast treatment and a static or reduced-motion alternative for
web delivery. Do not claim a flash-safety check without testing it. Use an
existing authorized assembly pipeline; otherwise hand off the frame order and
timing rather than claiming a rendered video. Do not install video tools or
publish output merely because a sequence was requested.

## Handoff

Return requested prompts or generated assets, selected preset names, reference
used, geometry limitations, and any checks performed. Separate prompts written,
images generated, frames approved, video rendered, and publication status.
