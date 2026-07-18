---
title: "Feedback Widget"
description: "Embed a feedback button and modal in your React app."
---

Drop-in React component that adds a floating feedback button to your app. Users can submit bugs, feature requests, and general feedback without leaving your site.

## Installation

```bash
npm install @saas-maker/feedback
```

## Usage

```tsx
import { FeedbackWidget } from '@saas-maker/feedback';

function App() {
  return (
    <FeedbackWidget
      projectId="pk_your_api_key"
      apiBaseUrl="https://api.sassmaker.com"
    />
  );
}
```

The widget renders a floating trigger button. Clicking it opens a modal where users can submit feedback with a title, description, type selector, and optional screenshot upload.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `projectId` | `string` | -- | Your project API key (required) |
| `apiBaseUrl` | `string` | -- | API base URL (required) |
| `userEmail` | `string` | -- | Pre-fill the submitter email |
| `userName` | `string` | -- | Pre-fill the submitter name |
| `types` | `FeedbackType[]` | `['bug', 'feature', 'feedback']` | Which feedback types to show |
| `position` | `'bottom-right' \| 'bottom-left'` | `'bottom-right'` | Trigger button position |
| `theme` | `'light' \| 'dark' \| 'auto'` | `'auto'` | Color theme |
| `accentColor` | `string` | `'#1464ff'` | Brand accent color |
| `triggerText` | `string` | `'Feedback'` | Text on the trigger button |

## Pre-filling user info

If your users are already signed in, pass their email and name to skip those fields in the form:

```tsx
<FeedbackWidget
  projectId="pk_your_api_key"
  apiBaseUrl="https://api.sassmaker.com"
  userEmail={currentUser.email}
  userName={currentUser.name}
/>
```

## Theming

The widget supports light, dark, and auto themes. The `auto` theme follows the user's system preference. You can also set a custom accent color:

```tsx
<FeedbackWidget
  projectId="pk_your_api_key"
  apiBaseUrl="https://api.sassmaker.com"
  theme="dark"
  accentColor="#ff6b00"
/>
```
