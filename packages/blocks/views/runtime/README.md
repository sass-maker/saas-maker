# @saas-maker/views-runtime

JSON spec → mounted React dashboard. Resolves bindings via `@saas-maker/capability-graph`.

## Quickstart

```tsx
import { z } from 'zod';
import { createGraph, entity } from '@saas-maker/capability-graph';
import { ViewRuntime } from '@saas-maker/views-runtime';

const Issue = entity({
  id: 'issue',
  fields: { id: z.string(), title: z.string(), status: z.string(), points: z.number() },
});

const graph = createGraph().provide({
  source: 'linear',
  entity: Issue,
  fetch: async () => [{ id: '1', title: 'Fix login', status: 'open', points: 3 }],
});

const spec = {
  id: 'sprint',
  title: 'Sprint health',
  bindings: { open: { entity: 'issue' } },
  blocks: [
    {
      id: 'velocity',
      type: 'MetricCard',
      binding: 'open',
      props: { label: 'Story points', field: 'points', aggregate: 'sum' },
    },
    {
      id: 'list',
      type: 'List',
      binding: 'open',
      props: { title: 'Open issues', primary: 'title', secondary: 'status' },
    },
  ],
};

export function Sprint() {
  return <ViewRuntime spec={spec} graph={graph} ctx={{ scopes: new Set(['issue:read']) }} />;
}
```

## Built-in blocks

| Type         | Props                                           | Description                                         |
| ------------ | ----------------------------------------------- | --------------------------------------------------- |
| `MetricCard` | `label, field, aggregate, format, prefix, suffix` | One number aggregated across rows                   |
| `List`       | `title, primary, secondary, meta, emptyText`    | Vertical list with two text columns + meta          |
| `Table`      | `title, columns: [{ field, label, align }]`     | Plain table; values formatted by primitive type     |

Pass a custom `blocks` map to `<ViewRuntime>` to register your own block types.

## Spec shape

See `spec.ts` — `ViewSpecSchema`. Highlights:

- `bindings`: map of name → `{ entity, source?, filter?, orderBy?, limit? }`
- `blocks`: array of `{ id, type, binding?, props?, layout? }`
- `layout`: `'grid' | 'flex' | 'stack'`

The runtime validates incoming spec with Zod and renders an error card on failure — useful when an LLM emits a malformed view.
