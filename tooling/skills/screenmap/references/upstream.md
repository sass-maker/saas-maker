# Upstream and adaptation notes

Source: <https://github.com/aleqsio/screenmap>

Website: <https://screenmap.dev>

Pinned revision: `c54219e4088965593a0cc4b2ce27251d2ce6321c`

Upstream license: MIT. See `../LICENSE`.

Fleet vendors the upstream skill scripts and format/provider documentation. It
does not vendor the Claude plugin manifest, viewer application, GitHub Action,
workflow templates, demo maps, or CI implementation.

Material Fleet changes:

- static analysis is the default first pass;
- package/tool installation and CI wiring require explicit authorization;
- project-configured custom parsers require `--allow-custom-command`;
- packers refuse to overwrite evidence bundles and flow conversion never
  deletes its source files;
- PR comparisons use isolated worktrees instead of stashing or switching the
  user's checkout;
- screenshots and bundles are private by default and are never published or
  uploaded implicitly;
- output, device proof, flow replay, CI, and publication are separate receipts.

When refreshing, compare this pinned revision with upstream and port changes
deliberately. Do not overwrite Fleet's safety gates with the upstream skill.
