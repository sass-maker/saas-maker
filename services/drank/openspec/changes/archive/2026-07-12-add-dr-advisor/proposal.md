## Why

Drank already tracks a domain's current DR and trend, but the proposed Advisor
document is stranded on the retired Vercel API architecture. Owners need a
small, honest interpretation layer that uses the measurements Drank actually
has without pretending the free Ahrefs endpoint exposes backlink evidence.

## What Changes

- Add an explicit Explain action to a domain's history detail.
- Add a Cloudflare Pages Function that sends only the normalized domain,
  current DR, and bounded trend summary to the existing free-ai gateway.
- Require structured, conservative output: a short explanation, explicit
  evidence limits, and three to five prioritized improvement steps.
- Cache successful advice locally by domain and measurement bucket; preserve
  normal DR tracking when generation is unavailable.
- Replace the obsolete proposal status with the shipped current-architecture
  contract once verification passes.

## Non-goals

- No paid Ahrefs metrics, backlink crawling, automated outreach, or claims
  about referring domains that Drank did not observe.
- No server-side storage of personal domains or advice.
- No deployment, secret provisioning, or production configuration change.

## Capabilities

### New Capabilities

- `dr-advisor`: Generate and locally cache bounded DR explanations and
  prioritized suggestions from a domain's observed DR history.

## Impact

- Dashboard: one Advisor panel inside the existing domain detail modal.
- API: one `/api/advisor` Cloudflare Pages Function.
- Data: versioned browser-local advice cache only.
- Dependencies: no new package; the endpoint uses native `fetch`.

