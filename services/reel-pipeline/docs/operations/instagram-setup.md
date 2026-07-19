# Instagram auto-posting setup

How to get from "I have an idea" → "Reel is live on IG" without manually clicking. Four viable paths; **for our case (posting only to our own handles), path B is the right answer** — a couple of hours, $0/mo, no Meta App Review.

## The four paths

| Path | Setup cost | Time to live | Monthly cost | Multi-account | Right for us when |
|---|---|---|---|---|---|
| **A. Reseller** (Post Bridge, Buffer, upload-post.com, Postiz Cloud) | ~1 hour | Same day | $5–$30 | Yes, native | We don't want to manage tokens; can spend ~$5/mo |
| **B. DIY for our own accounts — Standard Access** | ~2 hours | Today | $0 | Yes, one IG handle per app role | **Default for us.** We're posting only to IG handles we own |
| **C. Manual MBS** (Meta Business Suite by hand) | ~0 | Today | $0 | Yes, one click per account | Sanity-check while B is being set up |
| **D. DIY Tech Provider — Advanced Access** | 3–8 weeks wall-clock | After App Review | $0 | Yes, public OAuth | We ever want to post on behalf of *other people's* IG handles |

The earlier draft of this doc skipped **B** and went straight from reseller → full App Review. That was wrong: App Review and Business Verification only kick in for **Advanced Access**, which is only needed if you serve accounts you don't own. **Standard Access has neither requirement.**

## Prerequisites (all paths share these)

Regardless of path, every Instagram handle we want to post to needs:

1. **Instagram Professional account** — Business or Creator. Convert in the IG mobile app: Settings → Account type → Switch to professional. Free.
2. **Linked Facebook Page** — IG Pro accounts must link to a FB Page. In the IG app: Settings → Account Center → Profiles → add/link the FB Page. The Page can be empty; it's a structural requirement, not a content requirement.
3. **Admin access to the FB Page** — whoever runs the pipeline must be Page admin (not just editor).

That's the minimum any tool — reseller or DIY — needs to drive that handle's API. It's a Meta thing, not a Post Bridge thing.

## Path A: Reseller (recommended for starting)

### How Post Bridge actually works

Post Bridge is a **Meta Tech Provider**. They went through Meta App Review once for their own app and got `instagram_business_content_publish` approved. Now any user can:

1. Sign up at post-bridge.com.
2. Click "Connect Instagram" → OAuth into Post Bridge's already-approved Meta app → grant publishing scope to the handles you admin.
3. Post Bridge stores your long-lived page tokens, refreshes them, and exposes a clean REST API (`POST /posts` with `scheduled_at`, media uploads, multi-platform fan-out).

You **inherit their App Review approval**. You don't submit anything to Meta. Same model as Buffer, Later, Hootsuite, Sprout, Postiz Cloud, and `upload-post.com` (which this repo already has an adapter for at `src/posting.js:23`). They differ on price, platforms covered, and API ergonomics — not on the underlying gate.

### Trade-offs vs DIY

- **Pro:** working in an hour. Tokens, refresh, retries, error mapping all handled. Multi-account UI is theirs.
- **Pro:** if Meta deprecates an endpoint or changes auth (they do this often), the reseller fixes it server-side.
- **Con:** $5–$30/mo per workspace. Vendor lock-in via OAuth — switching means re-OAuthing every IG handle into the next reseller.
- **Con:** rate limits and queue policies are theirs, not yours.
- **Con:** if they're acquired, deprecated, or banned by Meta, all your handles need re-onboarding.

### Wiring to this pipeline

We already have a generic third-party adapter — `UploadPostProvider` at `src/posting.js:23` — that POSTs to `upload-post.com`. Same shape works for Post Bridge: it's just a different base URL + auth header + payload schema. Concretely:

1. Sign up + OAuth each IG handle.
2. Add a `PostBridgeProvider` class next to `UploadPostProvider` (same constructor pattern, ~30 lines).
3. Register `'post-bridge'` in `createPostingProvider`.
4. Multi-account: pass the Post Bridge `account_id` per request — they route to the right IG handle. No per-account creds for us to manage.

Don't build this until we've decided on Post Bridge specifically — pricing and feature set should drive the choice between Post Bridge / upload-post / Postiz Cloud.

## Path B: DIY for our own accounts (Standard Access — the easy path)

This is what unlocks IG for us. **No App Review, no Business Verification, no privacy policy, no screencast.** The app stays in "Development" mode forever; Meta is fine with that as long as we only post to IG handles where we hold an app role (Admin / Developer / Tester).

### Why it works

Meta gates the API at two levels:

- **Standard Access** — anyone with a role on your Meta app can use the API on accounts they admin. Default state. No review needed. Capped at 25 app users (we'll never hit this for our own handles).
- **Advanced Access** — anyone in the world can OAuth into your app. Requires App Review + Business Verification.

For "post to my own IG Business account from my own server," Standard Access is plenty.

### One-time setup (~2 hours including coffee)

1. **Convert IG to Professional** + **link to a FB Page** + **be Page admin** — the universal prereqs at the top of this doc.
2. **Meta Developer account** at developers.facebook.com — sign in with the Facebook account that admins the Page.
3. **Create App** → use case **"Other"** → type **"Business"**. Name it anything (e.g. `reel-pipeline`).
4. **Add product** → **Instagram** → **Set up**. Choose "Instagram API with Instagram Login" (the newer 2024 flow that doesn't require Facebook Login).
5. **Add yourself as Instagram Tester** — App Dashboard → Roles → Instagram Testers → add your IG handle. Then accept the invite from inside the IG app (Settings → Apps and Websites → Tester invites).
6. **OAuth your IG account** — use the bootstrap script (see below) to do the auth flow and grab a long-lived token (60-day TTL).
7. **Verify with one test post** — publish a private/draft Reel via the API to confirm the wire works.

### Wiring to this pipeline

The publish dance is two async steps, unlike YouTube's one-shot upload:

1. `POST /{ig-user-id}/media` with `media_type=REELS`, `video_url=<public URL>`, `caption=<...>` → returns container ID.
2. Poll `GET /{container-id}?fields=status_code` until it returns `FINISHED` (5–60 seconds for short Reels).
3. `POST /{ig-user-id}/media_publish` with the container ID → Reel is live.

Two practical implications for us:
- **Video needs a public URL.** Meta fetches the bytes; you can't upload them. We already have `REEL_ARTIFACT_R2_BUCKET` stubbed in `.env.example:13` — that's the publish hook.
- **Long-lived tokens expire every 60 days.** A small refresh job (single call to `GET /refresh_access_token`) keeps them alive. The same refresh extends another 60 days as long as the previous token isn't already expired, so a daily cron is plenty.

### Files shipped

- `src/publishers/instagram.js` — create-poll-publish + long-lived token refresh helper, defaults to `graph.instagram.com`.
- `src/posting.js` — `InstagramPostingProvider` (multi-account via `AccountRouter`); register with `'instagram'` mode in `createPostingProvider`.
- `scripts/instagram-oauth-bootstrap.js` — `npm run ig:bootstrap` mints the long-lived token + IG user ID for one handle.
- `scripts/refresh-instagram-tokens.js` — `npm run ig:refresh` extends every handle's TTL by 60 days; run daily via launchd (template in [`deployment.md`](./deployment.md)).
- `config/social-accounts.example.json` — unified YT+IG account map; secrets pulled from env via `*Env` pointers.

### Operator sequence (per IG handle)

```bash
# 1. Set IG_APP_ID + IG_APP_SECRET in your shell (from the Meta dev app)
export IG_APP_ID=... IG_APP_SECRET=...

# 2. Mint a long-lived token for this handle
IG_ACCOUNT_SLUG=tutoring npm run ig:bootstrap
# → opens an auth URL, you approve in browser, script prints
#   IG_TUTORING_USER_ID=...
#   IG_TUTORING_LONG_LIVED_TOKEN=...

# 3. Paste both into .env, then add the handle to config/social-accounts.json
#    under "instagram.tutoring" (mirroring the example file).

# 4. Verify
cargo run --quiet --manifest-path reel/Cargo.toml -- autopilot --once --execute --repo-root .
```

### Constraints to know

- **25 published posts per IG account per 24 hours** (Reels and Stories share the bucket). Same limit as Advanced Access — Meta enforces this on the account, not the access level.
- **No image carousel publishing in Standard Access for some endpoints** — Reels are fine, this caveat mostly bites carousel-of-photos use cases.
- **Token refresh** — if a token does expire (no calls for 60 days, refresh job broken), you have to re-run the OAuth bootstrap. Worth monitoring.

## Path D: DIY for posting on other people's accounts (Advanced Access — the slow path)

Only relevant if we ever want to ship a tool that *other people* connect their IG handles to. Then we'd be acting as a Meta Tech Provider — same model as Post Bridge — and we'd go through App Review + Business Verification.

Compressed version of the requirements:

- App Review for `instagram_business_content_publish` — 2–4 weeks per submission, plan for one rejection. Need a privacy policy, a screencast showing end-to-end usage, step-by-step reviewer instructions, app icon, business email.
- Business Verification — upload business docs, 1–5 business days.
- Common rejection reasons: screencast doesn't show real UI / requested extra scopes the app doesn't use / privacy policy looks generated / reviewer login instructions are unclear.

Don't pick this path for us. There's no scenario in the current tutoring campaign where we publish to anyone else's handle.

## Recommended order for us

1. **This week** — keep manual MBS (path C). Already documented, zero new code.
2. **Next** — set up path B for the IG handles we own. ~2 hours of clicking in the Meta dashboard, then we'd add the publisher + bootstrap script the same way we did for YouTube. $0/mo.
3. **Only if our needs change to "third parties OAuth in"** — start path D or pay a reseller (path A). Neither is on the roadmap now.

The reseller path is no longer the recommended first move — it's just a fallback if we don't want to babysit 60-day token refresh.

## Sources

- [Meta — Instagram Platform Overview (Standard vs Advanced Access)](https://developers.facebook.com/docs/instagram-platform/overview/)
- [Meta — Create an Instagram App](https://developers.facebook.com/docs/instagram-platform/create-an-instagram-app/)
- [Meta — Instagram Platform App Review (Advanced Access only)](https://developers.facebook.com/docs/instagram-platform/app-review/)
- [Postproxy — Post to Instagram via API: Guide (2026)](https://postproxy.dev/blog/post-to-instagram-via-api/)
- [Postproxy — Instagram Reels API Publishing Guide (2026)](https://postproxy.dev/blog/instagram-reels-api-publishing-guide/)
- [Post Bridge — API docs (reseller comparison)](https://support.post-bridge.com/api)
- [PostMoore — Common Meta App Review rejection reasons](https://www.postmoo.re/blogs/meta-app-review-disapproved-how-to-get-approved)
