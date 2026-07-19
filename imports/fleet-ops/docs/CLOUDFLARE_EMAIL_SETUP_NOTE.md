# Cloudflare Email Setup Note

Date: 2026-06-14

Inbound receiving is configured through Cloudflare Email Routing for:

- significanthobbies.com
- highsignal.app
- sassmaker.com
- karte.cc
- aliveville.com
- codevetter.com
- rolepatch.com
- sarthakagrawal.dev

For each domain, these addresses forward to `sarthakagrawal927@gmail.com`:

- `sarthak@<domain>`
- `team@<domain>`
- `hello@<domain>`

Catch-all forwarding is also enabled for each domain and forwards to the same Gmail inbox.

Outbound sending is enabled through Cloudflare Email Sending for each domain. Test emails from `sarthak@<domain>` were accepted by the Cloudflare API and arrived in Gmail.

To send from Gmail or another mail client, use Cloudflare SMTP:

```txt
Host: smtp.mx.cloudflare.net
Port: 465
Security: SSL / implicit TLS
Username: api_token
Password: scoped Cloudflare API token with Email Sending: Edit
```

Do not store API tokens in this repo. Revoke temporary tokens after use.

Note: Cloudflare Email Sending created DMARC records with `p=reject`. If another provider ever sends mail for these domains, update SPF/DKIM alignment or relax DMARC after testing.
