# `@saas-maker/newsletter-capture`

A consented newsletter and waitlist form for a product's existing footer. It
uses the SaaS Maker subscriptions API, shows status only from the API response,
and has no runtime dependency for browser-native integrations.

- Browser-native custom element for Astro, static HTML, and other sites.
- Thin optional React wrapper for React products.
- Publishable, product-scoped project key; no owner credentials in the browser.
- Fixed newsletter or waitlist mode by default, with explicit consent.
- No cookies, local storage, analytics, retry queue, or separate backend.

## Browser-native integration

Load the hosted browser bundle after the authored footer, or copy
`dist/browser/element.mjs` to the product's static assets when self-hosting:

```html
<script type="module" src="https://sassmaker.com/newsletter-capture.js"></script>
<saas-maker-newsletter-capture
  product-name="Acme"
  project-key="pk_example_publishable_key"
  source="footer"
  privacy-url="https://acme.example/privacy"
></saas-maker-newsletter-capture>
```

Only the publishable project key belongs in browser markup. Set an optional
`api-base-url` to the HTTPS API origin when using a compatible proxy or
development server; the default is `https://api.sassmaker.com`.

### Catalog-id mode

When a Fleet product is bound to a SaaS Maker project through the
`catalog_project_bindings` table, the element can resolve the publishable key
from a canonical catalog id alone. Use `catalog-id` instead of `project-key`:

```html
<saas-maker-newsletter-capture
  product-name="Acme"
  catalog-id="acme"
  source="footer"
></saas-maker-newsletter-capture>
```

The element calls `GET /v1/capture-config/:catalogId`, which returns only the
bound project's publishable `api_key` and minimal display metadata (`name`,
`slug`). It never returns owner/user data, private tokens, or unbound
projects. Unknown, malformed, and unbound ids all return the same 404 shape;
the form shows a neutral "not configured" status and prevents submission.

The resolved key is held only in memory for the current element instance; it is
not logged, stored, or sent anywhere except the existing `POST /v1/subscriptions`
contract. `project-key` takes precedence when both attributes are present, so
existing explicit-key integrations keep working unchanged. Config loading is
lifecycle-safe: a disconnect or attribute change cancels the in-flight request
and discards stale responses before they can mutate the form.

## Footer placement with Fleet components

Keep capture as its own region alongside the AI chat footer and portfolio
strip in the product's existing footer. A useful order is capture first, then
AI chat and the strip, then legal links. AI chat and the strip may already
compose into one extension; capture does not need to join that composition.
Render the feedback widget as its own hover button where the product has room
for it. This lets a product omit an inapplicable region without leaving a gap.

```html
<footer>
  <saas-maker-newsletter-capture
    product-name="Acme"
    project-key="pk_example_publishable_key"
    source="footer"
  ></saas-maker-newsletter-capture>
  <ai-chat-footer product-name="Acme" product-url="https://acme.example"></ai-chat-footer>
  <portfolio-project-strip current-project="acme"></portfolio-project-strip>
  <!-- Existing legal and product links follow. -->
</footer>
```

Load each package's browser entrypoint before these elements. The feedback
widget remains independent from this footer composition.

## React integration

```tsx
import { NewsletterCapture } from '@saas-maker/newsletter-capture';

export function FooterSignup() {
  return (
    <NewsletterCapture
      productName="Acme"
      projectKey="pk_example_publishable_key"
      source="footer"
      privacyUrl="https://acme.example/privacy"
      theme="light"
    />
  );
}
```

React and React DOM are peer dependencies; the browser-native entrypoint needs
neither.

## API contract

The component sends one request to `POST /v1/subscriptions`:

```http
X-Project-Key: pk_example_publishable_key
Content-Type: application/json
```

```json
{
  "email": "person@example.com",
  "kind": "newsletter",
  "source": "acme",
  "consent": true
}
```

`kind` is `newsletter` or `waitlist`. A successful 2xx response displays a
neutral receipt message. Validation, unavailable-service, rate-limit, and
network errors stay with the form; form values remain available for retry.

The endpoint stores the address and consent evidence in SaaS Maker. It may log
`newsletter.subscribe` or `waitlist.join` in App Health when that server-side
integration is configured. The browser package never sends a second analytics
event. Product privacy notices should describe email capture and retention.

Owner-authenticated subscription records include a per-record signed token for
an email unsubscribe link of the form
`https://sassmaker.com/unsubscribe#id=<record-id>&token=<unsubscribe-token>`.
The public page asks the recipient to confirm before posting the token to the
API. The fragment is removed from the address bar after the page reads it.
This package does not send email; any sender must include that link in each
message and must not log or expose the signed token elsewhere.

## Customization

Set `theme="light"` or `theme="dark"` on the custom element to use the provided
semantic defaults. Otherwise it inherits the host. Override CSS custom
properties on the host to match the product:

```css
saas-maker-newsletter-capture {
  --newsletter-capture-action: #176b43;
  --newsletter-capture-focus: #2563eb;
  --newsletter-capture-success: #187347;
}
```

Attributes and React props: `product-name` / `productName`, `project-key` /
`projectKey`, `catalog-id` / `catalogId`, `kind`, `allow-kind-selection` /
`allowKindSelection`, `source`, `api-base-url` / `apiBaseUrl`, `privacy-url` /
`privacyUrl`, `label`, and `theme`. Provide either `project-key` or
`catalog-id`; `project-key` takes precedence when both are present. Kind
defaults to `newsletter`; set `kind="waitlist"` (or `kind="waitlist"` in
React) for a fixed waitlist form. Set `allow-kind-selection` or
`allowKindSelection` only when visitors should choose between both options.
Consent text, description, and submit label follow the selected or
configured kind.

## License

MIT

### Shared footer presentation

Use `layout="compact"` (React or browser attribute) to stack the form inside a narrow shared-footer disclosure. This presentation attribute does not rebuild the browser form when changed; consent, identity, pending configuration and request behavior stay unchanged.
