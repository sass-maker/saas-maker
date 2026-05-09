---
title: Progress Widget
description: Show shipped updates and upcoming roadmap work from one public project feed.
---

The progress widget is the preferred public surface for product progress. It combines published changelog entries with public roadmap items, so users can see what shipped, what is in progress, and what is planned.

## Installation

```bash
npm install @saas-maker/progress
```

## Usage

```tsx
import { ProgressWidget } from '@saas-maker/progress';
import '@saas-maker/progress/dist/index.css';

function ProductProgress() {
  return (
    <ProgressWidget
      slug="my-project"
      apiBaseUrl="https://api.sassmaker.com"
      theme="auto"
    />
  );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `slug` | `string` | -- | Public project slug |
| `apiBaseUrl` | `string` | `https://api.sassmaker.com` | API base URL |
| `theme` | `'light' \| 'dark' \| 'auto'` | `'auto'` | Color theme |
| `maxChangelogItems` | `number` | -- | Limit shipped updates shown |
| `showEmptyStates` | `boolean` | `true` | Show empty-state copy when a section has no data |

## API

The widget reads one public endpoint:

```bash
curl "https://api.sassmaker.com/v1/progress/public/my-project?changelog_limit=10"
```

The response includes project metadata, published changelog entries, and public roadmap items.
