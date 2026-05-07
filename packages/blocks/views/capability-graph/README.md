# @saas-maker/capability-graph

Typed entity + capability registry for the views runtime.

Sources register entities they provide; views declare entities they need. The graph mediates: enforces scopes, routes queries, validates action arguments.

## Usage

```ts
import { z } from 'zod';
import { createGraph, entity, capability } from '@saas-maker/capability-graph';

const Email = entity({
  id: 'email',
  fields: {
    id: z.string(),
    subject: z.string(),
    isRead: z.boolean(),
  },
  actions: {
    archive: capability('email:write'),
  },
});

const graph = createGraph().provide({
  source: 'gmail',
  entity: Email,
  async fetch(_ctx, opts) {
    // call Gmail API, return rows matching Email schema
    return [{ id: '1', subject: 'hi', isRead: false }];
  },
  actions: {
    archive: async (_ctx, _args) => true,
  },
});

const ctx = { scopes: new Set(['email:read', 'email:write']) };
const inbox = await graph.query({ entityId: 'email' }, ctx);
await graph.invoke({ entityId: 'email', action: 'archive', args: undefined }, ctx);
```

## Concepts

- **Entity**: a vendor-agnostic shape (Email, Issue, Customer). Fields = Zod schemas. Actions = capability declarations.
- **Capability**: a declared scope plus optional Zod-validated args.
- **Provider**: a source (e.g. `gmail`) registering it can fetch entity data and run actions.
- **Graph**: runtime registry that enforces scopes and routes calls.

## Scope convention

- Reads: `<entityId>:read` (e.g. `email:read`)
- Writes: declared per-action (e.g. `email:write`)

The graph rejects calls if `ctx.scopes` does not include the required scope.
