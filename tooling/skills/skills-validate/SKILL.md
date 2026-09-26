---
name: skills-validate
description: >
  Validate a Fleet agent skill by clean-room testing: a fresh agent with no
  session history attempts real work (or a zero-cost plan) using only the
  skill's text, and the run is graded against a rubric so failures become
  specific edits to the skill. Use for "validate this skill", "test the
  skill", "does this skill work", "skill QA", or before merging a new or
  changed skill under tooling/skills. Not for validating product code.
---

# skills-validate

Mechanical checks prove a skill is well-formed. This skill proves it teaches:
a fresh agent that has never seen the repository tries to use it, and every
place that agent stalls or guesses is a defect in the skill text, never in
the agent. Adapted from the scenario-labs/skills validation protocol.

Usage: `skills-validate <skill-name> [--plan-only] [--task "..."] [--keep] [--baseline]`

- `--plan-only` asks the tester for a numbered action plan instead of live
  execution. Zero spend; use for skills that call paid APIs or have
  side effects.
- `--task "..."` supplies the use case instead of writing one. Criteria and
  budget are still written out first.
- `--baseline` runs the same task once with no skill installed. Required once
  per new skill: if the baseline succeeds cleanly, the skill is not earning
  its context cost. Skip it on re-runs after edits.
- `--keep` preserves the run directory for inspection.

## 1. Review the objective

Read `skills/<name>/SKILL.md` (the canonical copy under
`saas-maker/tooling/skills/`, or wherever the named skill lives) and every
file it links. If the name matches no directory, list the close ones and
stop.

State, in your own words: the objective in one sentence, the triggering
conditions the `description` claims, and the three to six non-obvious facts
the skill exists to teach, the ones an agent would otherwise guess wrong.
Those facts are the traps the run has to spring.

## 2. Write a concrete use case

One realistic task, in the words the operator would actually use, that forces
at least three of the traps and cannot be satisfied by generic agent
intuition. Give it explicit success criteria (which artifacts must exist,
what must be true of them, what must NOT happen) and a hard budget (how many
paid calls, which commands may run, which paths may be written). Print the
task and criteria before running anything. With `--task`, use the supplied
task and still write the criteria.

## 3. Run the mechanical checks first

They are free and catch the cheap failures:

- `node scripts/validate-tooling.mjs` from `saas-maker/tooling/` covers
  frontmatter keys, name-matches-directory, and relative links.
- Body word budget: `awk '/^---$/{c++; next} c>=2' skills/<name>/SKILL.md |
  wc -w`. Target 1000 words, flag past 2500: after context compaction an
  agent re-attaches only the head of each skill from a shared pool, so a fat
  body trades content for truncation.
- Fan-out: the skill plus every sibling it names is what one session actually
  loads. Sum their body word counts; flag when the total climbs past roughly
  10,000 words.
- Every file sitting next to SKILL.md is linked directly from it (agents
  resolve links one level deep; a chained reference may never be read).
- The `description` states triggering conditions, not a workflow summary.

Record results and continue either way; the report carries both layers.

## 4. Set up the clean room

Build a run directory outside any repository:

```bash
SKILL="<name>"
RUN=$(mktemp -d "${TMPDIR:-/tmp}/skill-validate-$SKILL-XXXXXX")
mkdir -p "$RUN/skills" "$RUN/work"
cp -R "skills/$SKILL" "$RUN/skills/"
```

Copy in each sibling skill the SKILL.md names; real sessions load them
together. Write the task from step 2 to `$RUN/task.md`, including the budget,
the success criteria, and the working path `$RUN/work`.

If the skill needs a target the tester must not choose (a repository, a
product, an account scope, credentials), the operator supplies it before the
run. A tester that picks its own target has already failed on the skill's
behalf.

## 5. Spawn a fresh agent

Pick the strongest isolation available:

- **Subagent** (default in Devin or Claude Code): spawn a fresh agent whose
  prompt contains only a framing line ("you are an agent working in
  $RUN/work; the skill documents under $RUN/skills are installed"), the task
  file path, and the contract below. It must not read the host repository or
  this conversation. Weaker than a separate process but clean of session
  history.
- **Separate process** when an agent CLI is installed: run it with cwd
  `$RUN/work` and the task as its prompt. Genuinely empty context.

Contract for the tester, verbatim:

```text
You are an agent working in <RUN>/work. The skill documents under
<RUN>/skills are installed. Do the task in <RUN>/task.md exactly as a user
asked it. Stay inside the stated budget. Do not read files outside <RUN>
except tools and config your host provides. When you are unsure of a fact
the documents do not state, record it in a `guesses` list instead of
guessing silently. Record friction: every place the instructions were
ambiguous, missing, or wrong. End with a list of artifacts produced.
```

Say in the report which isolation mode ran. With `--plan-only`, the task asks
for a numbered tool-and-command plan with exact names and argument shapes,
executing nothing, and flags uncertainty instead of guessing.

## 6. Grade the run

Fetch authoritative references fresh (read the actual files, run
`mcp_list_tools`, pull current docs) rather than recalling them, then judge:

- **Objective met.** The artifacts exist and satisfy the criteria. Open them;
  do not take the tester's word for it.
- **Real names only.** Every tool, command, file, and field the tester used
  exists. One invented name is a fail.
- **Correct flow.** The sequence the skill teaches. Check the transcript
  against it step by step.
- **Traps handled** the way the skill teaches, the facts from step 1.
- **Budget respected.** No calls, writes, or spend outside the stated limits.
- **No guessing.** Anything asserted that appears in neither the skill text
  nor a freshly checked reference is a guess, even when it is right. The
  tester's `guesses` and `friction` entries are the shortest route to the
  missing sentence.

Verdict: pass, pass with notes, or fail. Tie every defect to the exact line
of SKILL.md to add or change. After a fix, re-run with a new fresh agent: an
agent that failed once is contaminated by its own mistake and will pass or
fail for the wrong reasons.

## 7. Report

Print the report here; write it to a file or a GitHub issue only if asked.

```markdown
## Skill validation: `<name>` (<verdict>)

Objective: <one sentence>
Use case: <the task, one or two sentences>
Run: <subagent|separate process>, plan-only <yes|no>, <UTC timestamp>

### Mechanical checks

| Check | Result |
| ----- | ------ |

### Steps observed

| #   | Action | Outcome |
| --- | ------ | ------- |

Objective met: yes/no. <one sentence on what the agent produced>

### Defects

1. `skills/<name>/SKILL.md:<line>` <what the agent got wrong> -> <the
   sentence to add or change>

### Re-run

`skills-validate <name>` after the fix, with a fresh agent.
```

Delete the run directory unless `--keep` was passed.
