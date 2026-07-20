# saas-maker auth scaffold

**Tried:** A SaaS Maker auth helper scaffolded into drank (PR #6).

**Why it seemed good:** Fleet-wide auth reuse; looked like drank might
need accounts for some future feature.

**Why it failed:**

- No call sites ever consumed it.
- drank's thesis is explicitly **no sign-up, no server storage of user
  data**. Auth would break the local-first promise.

**What we do instead:** Removed the dead scaffold. If a future feature
genuinely needs identity, it must be an explicit opt-in design (see
deferred work in `PROJECT_STATUS.md`), not a leftover scaffold.

**Commit:** `c70b840` (remove dead saas-maker auth scaffold).
