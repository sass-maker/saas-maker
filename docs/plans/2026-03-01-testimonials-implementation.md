# Testimonials Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add testimonials collection and display — DB, API, dashboard page, and embeddable SDK widget.

**Architecture:** New `testimonials` table, Hono API routes with API key + session auth, dashboard moderation page, `@saasmaker/testimonials` React package with TestimonialForm and TestimonialWall components.

**Tech Stack:** React 19, tsup, Hono, postgres, TypeScript

---

### Task 1: Add testimonial types to shared-types

**Files:**
- Modify: `packages/shared-types/src/index.ts`

Add TestimonialStatus, TestimonialRecord, SubmitTestimonialRequest, TestimonialFormProps, TestimonialWallProps.

### Task 2: DB migration

**Files:**
- Create: `packages/db/migrations/0007_testimonials.sql`

CREATE TABLE testimonials with id, project_id, status, author fields, content, rating, image_url, tweet_url, created_at.

### Task 3: DB methods

**Files:**
- Modify: `workers/api/src/db.ts`

Add createTestimonial, listTestimonials (approved only), listAllTestimonials (dashboard), updateTestimonialStatus, deleteTestimonial, getTestimonialStats.

### Task 4: API route

**Files:**
- Create: `workers/api/src/routes/testimonials.ts`
- Modify: `workers/api/src/index.ts`

POST / (requireApiKey), GET / (requireApiKey, approved only), GET /all (requireSession), PATCH /:id (requireSession), DELETE /:id (requireSession).

### Task 5: Dashboard page

**Files:**
- Create: `apps/dashboard/src/app/projects/[slug]/testimonials/page.tsx`
- Create: `apps/dashboard/src/app/projects/[slug]/testimonials/testimonial-actions.tsx`
- Modify: `apps/dashboard/src/components/sidebar-nav.tsx`

Moderation table with approve/reject/delete actions, stat cards, sidebar nav item.

### Task 6: Scaffold testimonials-widget package

**Files:**
- Create: `packages/testimonials-widget/package.json`
- Create: `packages/testimonials-widget/tsconfig.json`
- Create: `packages/testimonials-widget/src/index.ts`
- Create: `packages/testimonials-widget/src/api.ts`

### Task 7: TestimonialForm component

**Files:**
- Create: `packages/testimonials-widget/src/TestimonialForm.tsx`
- Create: `packages/testimonials-widget/src/styles/testimonials.css` (form styles)

### Task 8: TestimonialWall component

**Files:**
- Create: `packages/testimonials-widget/src/TestimonialWall.tsx`
- Add wall styles to CSS

### Task 9: Build and verify

Build all packages, run tests, build dashboard.
