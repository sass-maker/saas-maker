# @saas-maker/testimonials

Embeddable React components for collecting and displaying testimonials with star ratings, images, and tweet embeds.

## Install

```bash
npm install @saas-maker/testimonials
```

## Components

### TestimonialForm — Collect testimonials

```tsx
import { TestimonialForm } from '@saas-maker/testimonials'

<TestimonialForm projectId="pk_your_api_key" />
```

### TestimonialWall — Display approved testimonials

```tsx
import { TestimonialWall } from '@saas-maker/testimonials'

<TestimonialWall projectId="pk_your_api_key" layout="masonry" />
```

## TestimonialForm Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| projectId | string | required | Your project API key |
| theme | 'light' \| 'dark' \| 'auto' | 'auto' | Color theme |
| accentColor | string | #1464ff | Primary accent color |
| showImageUpload | boolean | true | Show image upload |
| showTweetUrl | boolean | false | Show tweet URL field |
| buttonText | string | 'Submit Testimonial' | Button label |

## TestimonialWall Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| projectId | string | required | Your project API key |
| theme | 'light' \| 'dark' \| 'auto' | 'auto' | Color theme |
| layout | 'masonry' \| 'grid' \| 'list' | 'grid' | Layout style |
| maxItems | number | 50 | Max testimonials to show |
