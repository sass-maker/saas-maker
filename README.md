# SaaS Maker

SaaS Maker owns the public product directory and a small set of reusable,
backend-free product packages. It also provides the focused Feedback service,
image upload, project keys, and private feedback inbox.

Site Health owns private project identity and portfolio operations. SaaS Maker
consumes only its checked-in, privacy-filtered public catalog and never reads
private Fleet state at runtime. Reusable public automation is canonical under
[`tooling/`](tooling/README.md) and indexed at
[sassmaker.com/tools](https://sassmaker.com/tools).

## Products

- [sassmaker.com](https://sassmaker.com) — public product directory.
- [sassmaker.com/projects](https://sassmaker.com/projects) — filtered shareable public
  directory with expanded human and Markdown profiles for each identity.
- [sassmaker.com/ideas](https://sassmaker.com/ideas) — scored product-idea
  decision ledger.
- [sassmaker.com/tools](https://sassmaker.com/tools) — reusable skills,
  workflows, scripts, templates, and guides.
- `@saas-maker/feedback` — React feedback widget backed by the optional hosted
  submission service.
- `@saas-maker/ai-chat-footer` — backend-free links for asking AI assistants
  about a product.
- `@saas-maker/portfolio-project-strip` — accessible project-discovery footer
  backed by the same safe catalog as sassmaker.com.
- `api.sassmaker.com` — Feedback and project-key API.
- `app.sassmaker.com` — private Feedback inbox.

Package and service documentation stays in [`docs/`](docs/README.md) and the
individual package READMEs.

## Development

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm check:shared-packages
pnpm build:widget
pnpm build:showcase
pnpm build:cockpit
```

Production deployment and npm publication remain separate manual actions.
The [2026-09-07 hosted release receipt](docs/releases/2026-09-07-public-directory/README.md)
records the 21-entry directory, desktop/phone navigation, shared-asset parity
and rollback reference.
See [`PROJECT_STATUS.md`](PROJECT_STATUS.md) for durable product status and
[GitHub Issues](https://github.com/sass-maker/saas-maker/issues) for work.

<!-- portfolio-retained-work:2026-09-07 -->
## Retained work from the portfolio review

These are unresolved requirements retained at the owner’s request. They are not completed features. Work should follow a concrete need and fresh evidence.

### Cleanup repos and migrate unused projects to personal org

Reconcile project ownership and retained history; any organization transfer requires a concrete migration review.

Original requirements and discussion: [#91](https://github.com/sass-maker/saas-maker/issues/91).

### Bounded web, media and SEO research skills

Retain the routing, receipt and validation requirements in
[#103](https://github.com/sass-maker/saas-maker/issues/103). Its implementation
is in progress in the local checkout; task reconciliation does not establish
that those changes have been committed, pushed or validated at the remote head.
