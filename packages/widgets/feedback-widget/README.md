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
import '@saas-maker/feedback/dist/index.css'

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
| `apiBaseUrl` | `string` | `https://api.sassmaker.com` | API base URL |
| `userEmail` | `string` | — | Pre-fill submitter email |
| `userName` | `string` | — | Pre-fill submitter name |
| `types` | `FeedbackType[]` | `['bug', 'feature', 'feedback']` | Allowed feedback types |
| `position` | `'bottom-right' \| 'bottom-left'` | `'bottom-right'` | Trigger button position |
| `theme` | `'light' \| 'dark' \| 'auto'` | `'auto'` | Color theme |
| `accentColor` | `string` | `#1464ff` | Primary accent color |
| `triggerText` | `string` | `'Feedback'` | Trigger button label |
| `enablePointing` | `boolean` | `true` | Let users point at a page element to anchor feedback (captures selector + visible text + source) |

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

## Point at an element

The widget includes a **"◎ Point at an element"** control (on by default). The user clicks
it, then clicks any element on the page; the widget captures a stable CSS selector, the
element's visible text, and — in React dev, or wherever you emit `data-source` attributes —
the `file:line` source. That anchor is appended to the feedback description, so your team (or
a coding agent) can jump straight to the spot the feedback is about. The user's in-progress
text is preserved while they point, and the picker is dismissable with `Esc`.

Turn it off for a plain-form widget:

```tsx
<FeedbackWidget projectId="pk_xxx" enablePointing={false} />
```
