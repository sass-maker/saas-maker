---
title: Changelog Widget
description: Display your product changelog as an embeddable timeline in your React app.
---

A React component that renders your published changelog entries as a vertical timeline. Entries are fetched automatically from the API.

## Installation

```bash
npm install @saas-maker/changelog-widget
```

## Usage

```tsx
import { ChangelogTimeline } from '@saas-maker/changelog-widget';

function WhatsNew() {
  return (
    <ChangelogTimeline
      projectId="pk_your_api_key"
      apiBaseUrl="https://saasmaker-api.sarthakagrawal927.workers.dev"
    />
  );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `projectId` | `string` | -- | Your project API key (required) |
| `apiBaseUrl` | `string` | -- | API base URL (required) |
| `theme` | `'light' \| 'dark' \| 'auto'` | `'auto'` | Color theme |
| `maxItems` | `number` | -- | Limit the number of entries shown |

## What it renders

Each timeline entry displays:

- **Date** -- formatted publish date
- **Version badge** -- shown if a version string is set (e.g., `v1.2.0`)
- **Type badge** -- color-coded by entry type (`feature`, `improvement`, `fix`, `breaking`)
- **Title and content** -- the changelog entry body

Entries are sorted newest-first and only published entries are shown.

## Theming

The widget supports light, dark, and auto themes:

```tsx
<ChangelogTimeline
  projectId="pk_your_api_key"
  apiBaseUrl="https://saasmaker-api.sarthakagrawal927.workers.dev"
  theme="dark"
  maxItems={10}
/>
```
