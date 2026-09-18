# Fleet tooling task queue

Lightweight handoff queue for work that needs a future agent session — usually
a different capability set (browser access, human-in-the-loop auth) than the
session that filed the task.

## Convention

- One file per task: `YYYY-MM-DD-<slug>.md`
- Frontmatter: `status` (`pending` / `in-progress` / `done` / `blocked`),
  `needs` (capabilities the picking-up agent must have)
- Tasks are self-contained: context, steps, constraints, definition of done.
  A picking-up agent should not need the originating conversation.
- When starting: set `status: in-progress`, add your session date. When done:
  `status: done` + a short outcome note at the bottom. Don't delete files.

There is intentionally no tooling here — the files are the queue.
