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
absolute path to this checkout. Keep it scoped to directory runs.

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

The launcher clears inherited Tilion configuration except license-key
variables, then disables prewarming, automatic recovery, hosted services,
proxies, CAPTCHA providers, private-network targets and unrestricted output paths.
Initializing the MCP does not launch a browser. The first browser tool may
download the engine. Check the actual engine version and license status
before relying on v3; a missing activation key can select the older engine.
Do not sign up, activate, buy a license or modify an existing browser profile
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
   and operate the approved form. A caller with its own browser runner can
   use `get_stealth_cdp_endpoint` instead. Observe the page between actions;
   do not delegate an unattended submit/retry loop to `run_browser_task`.
4. Re-check exact fields and permissions before the final submit. Interactive
   CAPTCHA, email/identity verification, unexpected cost or changed terms
   end this headless route as `blocked`; record the challenge or unmet
   condition, close the session, and move on. There is no interactive
   handoff inside this invisible browser. Reconcile intake before any later
   separately supervised attempt in the normal browser. If Fortress still
   cannot reach the form, stop after this fallback attempt and record the
   remaining blocker.
5. Record `browser=fortress`, the observed engine version, initial blocker,
   outcome and any manual step in tracker `notes`. Keep intake confirmation
   in `evidence`; engine access or a completed click does not prove intake.
   Preserve `prepared`, `submitted`, `scheduled` and `live` meanings. Verify
   a claimed live listing separately in a normal logged-out browser.
6. Close the run's owned MCP/browser session when finished. Do not leave its
   CDP endpoint running or reuse its account session across campaigns.

The workflow is available when the host exposes the Fortress tools. If they
are absent, use the launcher setup above or record the missing capability;
do not claim the fallback ran. This integration does not itself submit any
directory listing.

Upstream references: [MCP tools](https://github.com/tiliondev/fortress/tree/main/mcp),
[releases](https://github.com/tiliondev/fortress/releases), and
[license](https://github.com/tiliondev/fortress/blob/main/LICENSE).
