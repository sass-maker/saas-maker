# @saas-maker/feedback

Drop-in React feedback widget for collecting bugs, feature requests, and general feedback.

## Install

```bash
npm install @saas-maker/feedback
# or
pnpm add @saas-maker/feedback
```

## Quick Start

```tsx
import { FeedbackWidget } from '@saas-maker/feedback'

function App() {
  return (
    <FeedbackWidget projectId="pk_your_api_key" />
  )
}
```

This renders a floating button that opens a feedback modal.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `projectId` | `string` | **required** | Your project API key (`pk_...`) |
| `apiBaseUrl` | `string` | `https://api.saasmaker.dev` | API base URL |
| `userEmail` | `string` | — | Pre-fill submitter email |
| `userName` | `string` | — | Pre-fill submitter name |
| `types` | `FeedbackType[]` | `['bug', 'feature', 'feedback']` | Allowed feedback types |
| `position` | `'bottom-right' \| 'bottom-left'` | `'bottom-right'` | Trigger button position |
| `theme` | `'light' \| 'dark' \| 'auto'` | `'auto'` | Color theme |
| `accentColor` | `string` | `#1464ff` | Primary accent color |
| `triggerText` | `string` | `'Feedback'` | Trigger button label |

## Examples

### Pre-fill user info

```tsx
<FeedbackWidget
  projectId="pk_xxx"
  userEmail="user@example.com"
  userName="Jane Doe"
/>
```

### Dark mode with custom color

```tsx
<FeedbackWidget
  projectId="pk_xxx"
  theme="dark"
  accentColor="#8b5cf6"
/>
```

### Feature requests only

```tsx
<FeedbackWidget
  projectId="pk_xxx"
  types={['feature']}
  triggerText="Request Feature"
/>
```
