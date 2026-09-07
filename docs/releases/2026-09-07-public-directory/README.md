# Public directory release — 2026-09-07

Production [sassmaker.com](https://sassmaker.com) serves source
`6508136de51d86d9f03bb66cbaa98f5edf0e82a4` through Pages deployment
`021f041d-7f23-4df9-80b1-7092acf6edcd` (`saas-maker-home`). The release
operator ran the deployment guard and four smoke checks before accepting the
release. Rollback reference: prior deployment
`39bfc313-dbe2-4a5b-ab05-296089db30f7`, source `2ceafd9`.

## Hosted acceptance

The release operator captured the [machine receipt](receipt.json) on the
ordinary public origin at 1440px and 390px. A separate documentation review
inspected both screenshots before retaining them here.

- The directory contains 21 public entries. Searching “Memory Map” gives one
  result; its profile navigation works. The paused-experiment group contains
  16 entries. Neither viewport has horizontal overflow.
- Memory Map's description, destination and evidence controls are readable in
  the [desktop screenshot](directory-1440.png) and
  [phone screenshot](directory-390.png).
- LoopTV's hosted shared strip is visible with 40 rendered links (20 distinct
  destinations repeated by the strip). The release check found no retired or
  held destinations. The complete observed link list is in the receipt.
- Public `projects.json`, `project-strip.js` and `ai-chat-footer.js` returned
  HTTP 200 and matched the release build byte for byte. SHA-256 hashes are
  retained in the receipt.

This qualifies directory navigation and the observed shared-asset rollout.
It does not establish every listed product's core journey, renew a paused
project's development commitment, publish npm packages, or release the
Feedback API/private inbox. Public catalog ownership remains with Site Health;
no private catalog data was imported into this evidence.

The evidence and README update are documentation only. They do not require a
second deployment. Unrelated local status/tooling work was excluded from the
receipt commit. The release operator retains ownership of the temporary
release checkout and its cleanup.
