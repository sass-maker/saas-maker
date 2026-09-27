# Newsletter and Waitlist Capture

## Purpose

Give visitors a clear, low-friction way to request newsletter or waitlist email
from a Fleet product footer, with consent captured alongside the address.

## Users and job

Visitors enter their address, review the consent statement, and submit once.
Products choose whether to offer newsletter or waitlist; visitors choose between
the two only when the product explicitly enables that choice. Product teams
provide their public SaaS Maker project key and product identity; SaaS Maker
owns storage and optional App Health events.

## Product contract

- Offer exactly two capture kinds: `newsletter` and `waitlist`.
- Require a valid email address and explicit unchecked-by-default consent.
- Send the accepted contract to `POST /v1/subscriptions` with `X-Project-Key`.
- Keep project keys publishable and destination-scoped; never request or store
  owner credentials.
- Report success only after the API returns a successful response.
- Support browser-native HTML consumers and a thin React wrapper without adding
  runtime dependencies.
- Keep this capture form separate from feedback collection.

## Non-goals

The package does not provide a backend, mailing service, campaign editor,
marketing automation, analytics, deduplication rules, or a feedback form. It
does not promise delivery frequency or availability beyond the product's own
consent language.
