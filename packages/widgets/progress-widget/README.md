# @saas-maker/progress

Embeddable public progress widget for SaaS Maker projects.

It combines:

- published changelog entries
- public roadmap items grouped as In Progress, Planned, and Shipped

## Install

```bash
npm install @saas-maker/progress
```

## Usage

```tsx
import { ProgressWidget } from '@saas-maker/progress';
import '@saas-maker/progress/dist/index.css';

<ProgressWidget slug="my-project" />
```

## Props

| Prop | Type | Default |
|---|---|---|
| `slug` | `string` | required |
| `apiBaseUrl` | `string` | `https://api.sassmaker.com` |
| `theme` | `light \| dark \| auto` | `auto` |
| `maxChangelogItems` | `number` | API default |
| `showEmptyStates` | `boolean` | `true` |
