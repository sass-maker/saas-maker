# Sample feature verification: invalid routes in Anime List

Verified locally on October 2, 2026. This is a replay of an existing repair in
my own public application, not a customer engagement or a newly discovered bug.

AI performed this verification: Codex selected the source and checks, invoked
the repository's Vitest runner, and wrote this report. The tests executed the
assertions; the AI interpreted their results. Sarthak did not personally perform
this verification.

## Result

The same 17 repository-owned middleware tests were run against exact source
blobs from the base and candidate of [Anime List PR #116](https://github.com/Significant-Hobbies/anime-list/pull/116).

| Source | Passed | Failed | Test-process exit |
| --- | ---: | ---: | ---: |
| Base `4ada36958450422f4dbc4158b9b41e6f0a2ab5e8` | 10 | 7 | 1 |
| Candidate `3b209f8dcfbc63b2f71e3d9b5d3e2b7bac74b725` | 17 | 0 | 0 |

The candidate passes this middleware contract. That verdict does not establish
browser behavior, complete application correctness, or a deployed repair.

## The behavior being checked

An unknown HTML route must return HTTP 404 with `noindex`, omit the homepage
canonical, and avoid caching the fallback. HEAD must agree with GET and have
no body. Existing application, API and static-asset routes must continue to
their existing handlers. Detail-page Markdown must reach its detail handler.

## What failed before the repair

- Three invalid routes (`/%60`, `/not-a-real-page`, `/missing.html`) returned
  an indexable HTTP 200 shell instead of the required 404.
- HEAD on `/%60` also returned the wrong status.
- Detail Markdown was intercepted instead of reaching the detail function.
- An invalid fallback retained the wrong status and stale entity headers.
- An unknown HTML fallback without SEO markers did not receive the required
  not-found response.

These are seven failing cases within one routing contract, not seven separate
security findings. Ten valid-route and static-asset checks already passed.

## How the result was obtained

1. Fetch the public PR head without changing a working branch:
   `git fetch --no-tags origin refs/pull/116/head`.
2. Read the test at the exact candidate revision:
   [pagesMiddleware.test.ts](https://github.com/Significant-Hobbies/anime-list/blob/3b209f8dcfbc63b2f71e3d9b5d3e2b7bac74b725/src/pagesMiddleware.test.ts).
3. Extract the middleware, its two local helpers, the public-surface data and
   HTML shell from each exact revision into separate temporary directories.
4. Run the unchanged candidate test against both source sets using Vitest
   4.1.10 in a Node environment. Save each exit code and JSON test report.
5. Record SHA-256 identities for the tested files and test itself. No source
   in the owning worktree was modified.

Test SHA-256: `e8a8b651d75f0757ae3499036c3118244a712ccb993c4ceb4f313c31ebd272bd`.

The downstream Cloudflare Pages response is stubbed by the repository test.
The source is real; the boundary is a middleware unit test. It does not run a
browser, a database, Google indexing, or the hosted candidate. Dependencies
were reused from the existing repository installation; this was not a fresh
lockfile installation.

## Decision

The local routing repair satisfies the declared contract. Deployment and a
hosted GET/HEAD check remain separate acceptance steps. No claim of search
traffic improvement, revenue, or production-wide accuracy follows from this
result.

## What a paid pilot delivers

For one agreed TypeScript/Node workflow: the acceptance contract, exact source
identity, relevant executable checks, reproducible defects where found, and
a concise report separating verified behavior from remaining gaps. AI agents
perform the verification and write the report; Sarthak is the contact for scope
and payment. A report
may establish a pass, fail, or unverified result; the fee does not promise a
particular verdict or a guaranteed defect count.

Discuss a pilot at team@sassmaker.com.
