# SaaS Maker

SaaS Maker is the public catalogue for Sarthak's products and the home of one
shared product primitive: customer feedback.

It deliberately does not own fleet operations, task queues, marketing
automation, observability, App Health, CodeVetter, Drank, Reel Pipeline, PSI
Swarm, or machine schedules. Those live in Fleet Workspace or their independent
product repositories.

## Surfaces

- https://sassmaker.com — public product directory built from Fleet's checked-in public projection.
- https://saas-maker-packages.pages.dev — Blume documentation for @saas-maker/feedback.
- https://api.sassmaker.com — feedback submission, image upload, project-key management, and feedback review API.
- https://app.sassmaker.com — private feedback inbox and project-key manager.

## Maintained package

~~~bash
pnpm add @saas-maker/feedback
~~~

~~~tsx
import { FeedbackWidget } from '@saas-maker/feedback';
import '@saas-maker/feedback/dist/index.css';

export function AppFeedback() {
  return <FeedbackWidget projectId="pk_your_project_key" />;
}
~~~

## Repository

~~~text
apps/showcase/                         public directory
apps/docs-blume/                       package documentation
apps/cockpit/                          private feedback inbox
packages/widgets/feedback-widget/      @saas-maker/feedback
packages/ui/                           private Cockpit UI primitives
workers/api/                           feedback API
internal/contracts/                    private feedback contracts
catalog/generated/public.json          checked-in Fleet public projection
~~~

## Development

~~~bash
pnpm install
pnpm test
pnpm typecheck
pnpm build:widget
pnpm build:showcase
pnpm build:docs
pnpm build:cockpit
~~~

Production deploys, database migrations, npm publication/deprecation, DNS
changes, and repository archival remain explicit manual actions.
> [!IMPORTANT]
> This repository was merged into
> [`sass-maker/fleet-workspace`](https://github.com/sass-maker/fleet-workspace).
> The maintained public directory is at `fleet-ops/apps/public-directory/` and
> the feedback package is at `fleet-ops/packages/feedback/`. This repository is
> retained for history and attribution only; do not clone it for Fleet setup or
> development.
