# SaaS Maker newsletter capture package

Also follow `../../AGENTS.md`.

This package owns the backend-backed, consented newsletter and waitlist footer
component. The subscription API remains owned by `workers/api`; do not add a
second backend, persistence layer, analytics path, or credential handling here.

Run `pnpm check` before shipping package changes. Publishing and Fleet product
rollout are separate owner-approved tasks.
