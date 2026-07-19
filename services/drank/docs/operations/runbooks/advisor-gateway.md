# Configure DR Advisor gateway

The DR Advisor (`/api/advisor`) calls the fleet free-ai gateway from a
Cloudflare Pages Function. The gateway credential must live in the Pages
Function environment — never in the client bundle, never in this repo.

## Required environment variables

Set these in the Cloudflare Pages dashboard → `drank` project →
Settings → Environment variables (Production, and Preview if you want
advisor in previews):

| Variable | Required | Purpose |
|---|---|---|
| `FREE_AI_GATEWAY_API_KEY` | yes (or `GATEWAY_API_KEY`) | Bearer token for the free-ai gateway. |
| `GATEWAY_API_KEY` | fallback | Legacy alias; `FREE_AI_GATEWAY_API_KEY` wins. |
| `FREE_AI_BASE_URL` | no | Override the gateway base URL. Defaults to `https://ai-gateway.sassmaker.com`. |

## How the function reads them

`functions/api/advisor.ts`:

```ts
const apiKey = context.env.FREE_AI_GATEWAY_API_KEY ?? context.env.GATEWAY_API_KEY;
if (!apiKey) {
  return json({ error: 'DR Advisor is not configured…', retryable: true }, 503);
}
const baseUrl = (context.env.FREE_AI_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '');
```

If neither key is set, the endpoint returns `503` with a retryable
unavailable response and the rest of drank keeps working (see
[ADR-0003](../../architecture/decisions/0003-dr-advisor-server-side-gateway.md)).

## Setting the secrets

Do not commit secrets. Use the Cloudflare dashboard or:

```bash
wrangler pages secret put FREE_AI_GATEWAY_API_KEY --project-name=drank
# paste the value when prompted; repeat for FREE_AI_BASE_URL if needed
```

> Never echo, print, or commit these values. This runbook only names them.

## Verifying

After setting the secret and a successful deploy:

```bash
curl -X POST https://domains.sassmaker.com/api/advisor \
  -H 'Content-Type: application/json' \
  -d '{"domain":"example.com","currentDr":42,"trend":{"direction":"up","delta":2,"periodDays":7}}'
```

Expected: `{"advice":{"schemaVersion":1,"why":"…","evidenceLimit":"…","actions":[…]},"generatedAt":…}`.

Without the secret configured, the same call returns the 503 unavailable
response — that is the expected fail-closed state, not a bug.

## Rotation

Rotate by putting a new value into the same Pages secret name and redeploying.
The old value is replaced; no code change is needed.
