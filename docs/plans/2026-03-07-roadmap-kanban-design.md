# Public Roadmap Kanban Board — Design

## Goal

Add a public Kanban roadmap board to each project. Owners use it as a task manager (create tasks, triage feedback into actionable items, drag between columns). The public sees the roadmap and can upvote cards. Private cards are hidden from the public view.

## Data Model

### `roadmap_items` table

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| project_id | uuid | FK to projects |
| feedback_id | uuid, nullable | FK to feedback (null if owner-created) |
| title | text | Required |
| description | text, nullable | |
| column | enum | `backlog`, `planned`, `in_progress`, `done` |
| position | integer | Order within column |
| public | boolean | Default true. False = owner-only |
| upvote_count | integer | Default 0 |
| downvote_count | integer | Default 0 |
| created_at | timestamp | |
| updated_at | timestamp | |

### `roadmap_votes` table

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| roadmap_item_id | uuid | FK to roadmap_items |
| user_identifier | text | Email or anonymous ID |
| vote | 1 / -1 | |
| created_at | timestamp | |
| **unique** | (roadmap_item_id, user_identifier) | One vote per user per item |

### Feedback changes

- When promoted to roadmap, feedback row gets `status = 'on_roadmap'` (new status value)
- Feedback stays in list with "On Roadmap" badge
- New dismiss action sets `status = 'dismissed'`

## API Routes

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/v1/roadmap/:slug` | None | Public roadmap items by project slug |
| POST | `/v1/roadmap/dashboard/:projectId` | Session | Create roadmap item |
| PATCH | `/v1/roadmap/dashboard/:projectId/:id` | Session | Update item |
| DELETE | `/v1/roadmap/dashboard/:projectId/:id` | Session | Delete item |
| POST | `/v1/roadmap/dashboard/:projectId/reorder` | Session | Batch update positions after drag |
| POST | `/v1/roadmap/dashboard/:projectId/from-feedback/:feedbackId` | Session | Promote feedback to roadmap |
| POST | `/v1/roadmap/:slug/:id/vote` | None | Public upvote/downvote |

## Pages

### Dashboard: `/projects/[slug]/roadmap`

- Owner's full Kanban view with all cards (including private)
- 4 fixed columns: Backlog, Planned, In Progress, Done
- Drag-and-drop via `@dnd-kit/core` + `@dnd-kit/sortable`
- "Add Task" button at top of each column (inline quick-add)
- Click card to edit (title, description, column, public toggle)
- Private cards show lock icon
- Cards from feedback show link icon back to feedback

### Public: `/r/[slug]`

- Read-only Kanban (no drag)
- Only public cards visible
- Upvote button on each card
- Clean, minimal UI

### Feedback page changes

- New action: "Move to Roadmap" per feedback row
- New action: "Dismiss" per feedback row
- "On Roadmap" badge on promoted items
- Filter bar: add `dismissed` and `on_roadmap` status options

## Sidebar

Add "Roadmap" nav item between "Feedback" and "Testimonials" in sidebar-nav.tsx.

## Tech

- Drag-and-drop: `@dnd-kit/core` + `@dnd-kit/sortable` (~10KB, accessible, Next.js compatible)
- Reorder endpoint accepts `{ items: [{ id, column, position }] }` for batch position updates after drag
- Public page uses same column layout but without DnD listeners
