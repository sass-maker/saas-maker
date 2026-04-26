# @saas-maker/changelog-widget

Embeddable React component for displaying a changelog timeline with version badges, type indicators, and dark mode support.

## Install

```bash
npm install @saas-maker/changelog-widget
```

## Usage

```tsx
import { ChangelogTimeline } from '@saas-maker/changelog-widget'

<ChangelogTimeline projectId="pk_your_api_key" />
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| projectId | string | required | Your project API key |
| apiBaseUrl | string | https://api.sassmaker.com | API base URL |
| theme | 'light' \| 'dark' \| 'auto' | 'auto' | Color theme |
| maxItems | number | 50 | Max entries to display |

## Features

- Timeline layout with color-coded type dots (blue=feature, green=improvement, yellow=fix, red=breaking)
- Version badges
- Light/dark/auto theme support
- Self-contained CSS with `smw-cl-` prefix (no conflicts)
- Responsive design
