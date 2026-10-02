# Rendered review rubric

Use this for the final critique and audit. The canonical policy's weights are
projected into `tooling/config/design-workflow.json`; the receipt records each
dimension under `evidence.critique.dimensions` or `evidence.audit.dimensions`.
The total is the sum of those dimensions. These are reviewer judgments with
supporting observations, not measured probabilities of good taste.

## Critique: 40 points

| Dimension | Maximum | What to inspect against the selected direction |
| --- | ---: | --- |
| Hierarchy | 8 | The screen job, reading order, primary action and relative emphasis are obvious; competing elements do not dilute them. |
| Typography | 8 | Type choices, measure, line height, weight, spacing and metadata treatment form a legible, intentional hierarchy at actual content lengths. |
| Composition | 8 | Density, alignment, proportion, grouping and whitespace suit the real content and task; the result carries the selected system across more than a hero. |
| Identity | 8 | The signature and visual decisions belong to this product; changing its name and screenshot would not make it an unrelated generic template. |
| Interaction | 4 | Selection, focus, feedback, transitions and relevant loading/empty/error states remain coherent with the direction and task. |
| Responsive | 4 | Compact, intermediate and wide layouts retain the intended hierarchy, identity, readable content and core capability. |

Within each dimension, use its full range: 0 for unreviewed or fundamentally
broken work; roughly half for a plausible but visibly weak implementation;
roughly three quarters for a coherent result with bounded remaining weaknesses;
maximum only when concrete rendered evidence supports accomplished craft.
Explain deductions and remaining tradeoffs. A dimension that undermines the
brief is P1 and must be fixed regardless of the total. Mark an interaction
check not applicable only with a reason; score the intentional fit of a passive
surface rather than pretending interactions were tested.

## Audit: 20 points

| Dimension | Maximum | Required observations |
| --- | ---: | --- |
| Purpose | 4 | Accurate product/lifecycle claims and an honest next action; use the separate purpose score for Persuade surfaces. |
| Accessibility | 6 | Relevant keyboard/focus, semantic structure, contrast, labels, touch targets and reduced-motion behavior. |
| Behavior | 4 | The primary user path and affected component states work; no invented success or capability. |
| Responsive | 3 | Required viewports have no unintended clipping, overflow, inaccessible navigation or lost functionality. |
| Performance | 3 | Proportionate evidence for loading/interaction cost and new effects; use a production-equivalent build for release measurements. |

Record actual checks and their limits. Unmeasured behavior is unknown, not a
full score. A lack of applicability must be explained by the surface's job,
not used to hide an unavailable check. Zero unresolved P0/P1, passing project
checks and the six craft observations remain separate gates. Do not tune scores
or detector findings to make a weak result pass. Owner direction selection and
owner acceptance of the finished result remain distinct.

## Deliver the rendered work

For direction selection, deliver polished visual alternatives with real content.
For implementation tasks, deliver the working surface and show its rendered
result. For critique-only tasks, show the observed defects and actionable fixes;
do not imply implementation occurred. Keep the requested scope and approval gates.

Review against the selected direction, reference qualities and concrete quality
bar. If composition, typography or identity still looks weak or generic, identify
the visible cause, fix it, re-render and review again within the approved direction.
Reaching a score floor does not end this judgment. Record blocked inspection
honestly; do not manufacture a clean result.

At handoff, link the actual previews or captures and the running surface when
available. Show landing and app together for paired products, including a compact
layout and representative core app state. Use before/after evidence for an existing
surface. Explain the main visible fixes and remaining tradeoffs with concise
verification. Receipts and scores support this visible output. Publication is
subject to the task's existing authorization.

## Instruction or model comparisons

Borrow the same-brief comparison approach from [WhichAI](https://www.whichai.dev/)
only when an evaluation or exploration is requested. Hold the product brief,
content, assets, framework, viewport, and effort budget constant; vary one
instruction set or model at a time and record the configuration. Judge outputs
without model labels where practical, using the existing purpose, visual,
accessibility, interaction, and performance gates, not screenshots alone.
Record useful differences and recurring failures in the existing receipt.
One brief is directional evidence, not a general model ranking. WhichAI's
personal taste rankings do not change Fleet's model defaults, and this method
does not add a routine multi-variant step or authorize extra agents or spend.
