# @saasmaker/analytics-sdk

Privacy-friendly analytics tracking. No cookies, respects Do Not Track.

## Install

### Script tag (recommended)

```html
<script defer src="https://unpkg.com/@saasmaker/analytics-sdk" data-project="pk_your_api_key"></script>
```

### npm

```bash
npm install @saasmaker/analytics-sdk
```

## Features

- Automatic page view tracking
- SPA support (patches `history.pushState` / `replaceState`)
- UTM parameter extraction
- Screen width reporting
- Custom event tracking
- Respects `Do Not Track` browser setting
- No cookies, no fingerprinting

## Custom Events

```javascript
// After the script loads, `window.sm` is available:
sm.track('signup', { plan: 'pro' })
sm.track('purchase', { amount: 29.99, currency: 'USD' })
```

### Queue pattern

Calls before the script loads are buffered automatically:

```html
<script>
  window.sm = window.sm || function() { sm.q = sm.q || []; sm.q.push(arguments); };
  sm('early_event', { source: 'header' });
</script>
<script defer src="https://unpkg.com/@saasmaker/analytics-sdk" data-project="pk_xxx"></script>
```

## Configuration

Set attributes on the script tag:

| Attribute | Default | Description |
|-----------|---------|-------------|
| `data-project` | **required** | Your project API key |
| `data-api` | `https://api.saasmaker.dev` | API base URL |

## What gets tracked

Each event sends:
- Event name (`page_view` or custom)
- Current URL
- Referrer
- Screen width
- UTM parameters (if present in URL)

The server adds country, device type, and browser from request headers.
