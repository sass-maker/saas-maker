---
title: Survey Widget
description: Embed forms and surveys in your React app with a drop-in component.
---

Drop-in React component that renders a published form or survey inside your app. Handles fetching questions, rendering inputs, validation, and submission.

## Installation

```bash
npm install @saas-maker/survey
```

## Usage

```tsx
import { SurveyWidget } from '@saas-maker/survey';

function App() {
  return (
    <SurveyWidget
      projectId="pk_your_api_key"
      formSlug="customer-survey"
    />
  );
}
```

The widget fetches the form by slug, renders each question with the appropriate input type, validates required fields, and submits the response to the API.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `projectId` | `string` | -- | Your project API key (required) |
| `formSlug` | `string` | -- | Slug of the published form (required) |
| `theme` | `'light' \| 'dark' \| 'auto'` | `'auto'` | Color theme |
| `accentColor` | `string` | `'#1464ff'` | Brand accent color |
| `onComplete` | `(response) => void` | -- | Callback after successful submission |

## Theming

The widget supports light, dark, and auto themes. The `auto` theme follows the user's system preference. You can also set a custom accent color:

```tsx
<SurveyWidget
  projectId="pk_your_api_key"
  formSlug="customer-survey"
  theme="dark"
  accentColor="#ff6b00"
  onComplete={(res) => console.log('Submitted', res)}
/>
```

## Hosted survey page

If embedding a React component is not practical, you can share the built-in hosted survey page:

```
https://app.sassmaker.com/s/[form-slug]
```

This is useful for email campaigns, QR codes, and onboarding flows. No authentication or API key is required — the page uses the public submission endpoint.
