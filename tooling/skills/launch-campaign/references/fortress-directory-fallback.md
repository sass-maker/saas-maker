# Fortress directory fallback

Use Fortress only for an approved directory-submission route whose normal
browser is blocked by automation detection before intake. This is the
owner-requested exception to the normal connected-browser lane. Keep the
same destination, account, approved copy and publication permissions. Do not
use it for protected social channels or directories that prohibit automation.

## Start the optional MCP

The launcher uses uv's isolated cache, with exact top-level framework and
engine SDK versions, instead of adding a production dependency or a global
package. Transitive dependencies are resolved by uv and are not locked:

```bash
bash tooling/skills/launch-campaign/scripts/fortress-mcp.sh
```

Run it as a stdio MCP server in the executing agent's host. A host using
`mcpServers` can register the following entry; replace the path with the
absolute path to this checkout. Register it only for this directory run and
remove the entry afterward; do not install a standing global MCP server.

```json
{
  "mcpServers": {
    "fortress-directory": {
      "command": "bash",
      "args": ["<checkout>/tooling/skills/launch-campaign/scripts/fortress-mcp.sh"]
    }
  }
}
```

The launcher clears inherited Tilion configuration except the supported
`TILION_LICENSE_KEY`, and clears Fortress download/cache overrides and standard
proxy variables. It disables configured hosted services, prewarming, automatic
recovery, CAPTCHA providers, private-network targets and unrestricted output
paths, and assigns a fresh private output directory per run. This is configuration
hardening, not an OS sandbox or a guarantee about engine network behavior.
The package versions are pinned; the SDK downloads its engine separately and
its upstream checksum behavior is not strengthened by this launcher.
Initializing the MCP does not launch a browser. The first browser tool may
download the engine. Check the actual engine version and license status
before relying on v3; a missing activation key can select the older engine.
An existing inherited `TILION_LICENSE_KEY` may be used in memory; never read,
copy or log its value. Do not sign up, activate, buy a license or modify an existing browser profile
as part of an automatic fallback. Record missing setup as `blocked` and
continue independent routes. Foreground browser work still needs the host's
applicable authorization.

## Execute one bounded fallback

1. Record the normal browser's blocker and confirm no submission or draft
   creation is unresolved. If intake might already have happened, reconcile
   in the original session first. Never switch engines to repeat an
   indeterminate submit.
2. Start one separate Fortress session for this run. Do not copy Chrome
   cookies, saved profiles, credentials or license keys into it or the
   tracker. If the route needs an unavailable login, record `blocked`.
3. Use `page_elements`, `read_page`, `fill_field` and `click_button` to inspect
   and operate the approved form, with `current_page`, `wait_for`, `list_tabs`
   and `close_tab` as needed. Observe the page between actions. The upstream
   server exposes additional tools: their presence is not permission to use
   them. Do not call `reddit_*`, `get_cookies`, `save_profile`, `load_profile`,
   `evaluate_js`, `solve_captcha`, `get_stealth_cdp_endpoint`, `run_template` or
   `run_browser_task`. Do not export a CDP endpoint or use another browser runner.
   This is an agent workflow restriction, not a server-side tool sandbox.
4. Re-check exact fields and permissions before the final submit. Interactive
   CAPTCHA, email/identity verification, unexpected cost or changed terms
   end this headless route as `blocked`; record the challenge or unmet
   condition, close the session, and move on. There is no interactive
   handoff inside this invisible browser. Reconcile intake before any later
   separately supervised attempt in the normal browser. If Fortress still
   cannot reach the form, stop after this fallback attempt and record the
   remaining blocker.
5. Record `browser=fortress`, the observed engine version, initial blocker,
   outcome and any human-gate blocker in tracker `notes`. Keep intake confirmation
   in `evidence`; engine access or a completed click does not prove intake.
   Preserve `prepared`, `submitted`, `scheduled` and `live` meanings. Verify
   a claimed live listing separately in a normal logged-out browser.
6. Close the run's owned MCP/browser session when finished. Do not leave its
   browser running or reuse its account session across campaigns. Do not save
   account state or cookies. Unexpected files in the private output directory
   stay local for investigation; never import them into another run.

The workflow is available when the host exposes the Fortress tools. If they
are absent, use the launcher setup above or record the missing capability;
do not claim the fallback ran. This integration does not itself submit any
directory listing.

Upstream references: [MCP tools](https://github.com/tiliondev/fortress/tree/main/mcp),
[releases](https://github.com/tiliondev/fortress/releases), and
[license](https://github.com/tiliondev/fortress/blob/main/LICENSE).
