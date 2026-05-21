# Analytics kit

The fixed **4-event taxonomy** every fleet project emits. Extracted from the
`resume-tailor` pilot (Wave 1-E).

## Why a fixed taxonomy

We do **not** build a custom analytics dashboard. That would mean rebuilding a
worse PostHog and maintaining it forever.

Instead: **one PostHog project, every event tagged with `project`.** Because
all 16 projects emit the *same four events* with the same names, a single
PostHog login gives both per-app and cross-fleet views — one funnel, one
retention insight — with zero custom UI.

The taxonomy only works if it is identical everywhere. Do not invent new
top-level event names per project; product-specific detail goes in the
`core_action` `action` property.

## The 4 events

| Event | Fires when | Notes |
|---|---|---|
| `signup` | The first session after an account is created | Fire once per user. |
| `activated` | The user reaches first real product value | Project-specific milestone — the moment they "get it". Fire once per user. |
| `core_action` | The user does the thing the product exists to do | Fires every time. Carries an `action` property naming the specific action. |
| `returned` | A session starts for a user who has prior activity | Powers the D1/D7 retention insight. |

Every event also carries:

| Property | On | Value |
|---|---|---|
| `project` | all 4 events | The project slug (e.g. `"resume-tailor"`) — the cross-fleet key. |
| `action` | `core_action` only | One of the project's `CoreAction` values. |

### Picking each event per project

`signup` and `returned` are mechanical — wire them in the auth/session layer.
The two that need a product decision:

- **`activated`** — the *first* time the user gets real value. Not "signed up",
  not "clicked around". Resume-tailor: first successful tailor run.
- **`core_action`** — the repeatable core verb. Resume-tailor:
  `tailor_completed`, `cover_letter_generated`, `fit_score_run`.

Keep the `CoreAction` union small and meaningful — it should describe the
product in 2-4 verbs.

## What's in here

| File | Drop it at |
|---|---|
| `analytics.ts.template` | `src/lib/analytics.ts` |

Strip the `.template` suffix when copying into a project.

## Wiring it up

1. Copy `analytics.ts.template` → `src/lib/analytics.ts`. Fill the
   placeholders: `PROJECT`, the PostHog env vars, and the `CoreAction` union.
2. Wire each event at its trigger point:

   | Event | Typical trigger point |
   |---|---|
   | `signup` | First render after account creation (auth provider / callback). |
   | `activated` | The server action behind the first-value milestone — fire only if it's the user's first. Pass `distinctId`. |
   | `core_action` | Each server action / handler for a core verb. Pass `distinctId`. |
   | `returned` | Session-start client component, when the user has prior activity. |

3. The wrapper is isomorphic — call the same `trackActivated()` /
   `trackCoreAction()` from a server action or the browser. In a server
   context, pass `distinctId` so the event attaches to the right user.

## PostHog UI setup (once per project)

The code only emits events. Build these two insights by hand in PostHog, once:

1. **Funnel:** `signup → activated → core_action`, filtered to this
   `project`.
2. **Retention insight:** D1/D7 retention on `returned`, filtered to this
   `project`.

For the cross-fleet view, build the same two without the `project` filter, or
break down by the `project` property.

## Built on `@saas-maker/posthog-client`

This template imports `track` (browser) and `trackServer` /
`createPostHogServer` (server) from `@saas-maker/posthog-client`. Install it:

```bash
pnpm add @saas-maker/posthog-client
```

The taxonomy is intentionally a thin wrapper so it can later be folded
directly into `@saas-maker/posthog-client` as a first-class export.

## Reference implementation

`resume-tailor`: `src/lib/analytics.ts` (the taxonomy original) and
`src/lib/foundry-monitoring.ts` (shared PostHog config).
