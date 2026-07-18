# Submodule Sync Policy

`reel-pipeline` pins upstream engines as git submodules. They are not copied into
our product layer and they should not auto-update.

## Current Engines

```bash
git submodule status
```

- `engines/MoneyPrinterTurbo` — default cheap stock-footage renderer.
- `engines/openshorts` — UGC actor and publishing workflow reference.
- `engines/reel-maker` — internal Remotion/Modal prototype engine.

## Fresh Clone

```bash
git clone --recurse-submodules <repo-url>
# or, after cloning without submodules:
git submodule update --init --recursive
```

## Update Rule

Do not update submodules on main casually. Upgrade only on a branch:

```bash
git checkout -b upgrade/video-engines-YYYY-MM-DD
git submodule update --remote engines/MoneyPrinterTurbo
npm test
npm run smoke:mock
```

Before accepting an update, run at least one real render canary for the affected
engine and record the output artifact URL/path in the PR or task.

## Adapter Boundary

Our code must call engines through adapters under `src/adapters/`. Avoid editing
files inside `engines/*`. If an upstream patch is unavoidable, document it in
[`architecture/engines.md`](../architecture/engines.md) and prefer sending it
upstream or carrying a tiny patch file.
