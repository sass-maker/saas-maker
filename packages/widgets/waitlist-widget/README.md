# @saas-maker/waitlist

Drop-in React waitlist signup form with position tracking and count display.

## Install

```bash
npm install @saas-maker/waitlist
# or
pnpm add @saas-maker/waitlist
```

## Quick Start

```tsx
import { WaitlistForm } from '@saas-maker/waitlist'

function App() {
  return (
    <WaitlistForm projectId="pk_your_api_key" />
  )
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `projectId` | `string` | **required** | Your project API key (`pk_...`) |
| `apiBaseUrl` | `string` | `https://api.sassmaker.com` | API base URL |
| `theme` | `'light' \| 'dark' \| 'auto'` | `'auto'` | Color theme |
| `accentColor` | `string` | `#1464ff` | Primary accent color |
| `showCount` | `boolean` | `true` | Show "N already signed up" |
| `onSuccess` | `(position: number) => void` | — | Called after successful signup |
| `placeholder` | `string` | `'you@example.com'` | Email input placeholder |
| `buttonText` | `string` | `'Join Waitlist'` | Submit button text |

## Examples

### Custom styling

```tsx
<WaitlistForm
  projectId="pk_xxx"
  theme="dark"
  accentColor="#10b981"
  buttonText="Get Early Access"
/>
```

### With success callback

```tsx
<WaitlistForm
  projectId="pk_xxx"
  onSuccess={(position) => {
    console.log(`User is #${position} on the waitlist`)
  }}
/>
```

### Hide signup count

```tsx
<WaitlistForm
  projectId="pk_xxx"
  showCount={false}
/>
```
