# Design — studio-web-ui

## Approach

Mirror the `/review` pattern: server-rendered single HTML string, vanilla JS
`fetch` calls, no build step, no dependencies. Two new modules keep
`src/server/index.js` small:

- `src/studio/api.js` — `handleStudioRequest(method, pathname, body, options)`
  returns `{ status, body }` or `null` when the path is not a studio route.
  One dispatch table mapping tool name → handler; handlers call the existing
  `src/studio/` modules directly (same signatures the CLI uses). Errors from
  handlers become 400 via the server's existing try/catch; unknown tools 404.
  `faceless` forces `engine` to `mock` unless the body explicitly passes
  `moneyprinterturbo`, and never passes posting options.
- `src/studio/ui.js` — `studioPageHtml()` returns the page: a left tool list
  and a main panel per tool (inputs sized to each tool), results rendered as
  formatted JSON with copy buttons, plus an ideas-manager table. Dense,
  keyboard-friendly, no external fonts/CDN (fleet operator-UI standard).

Server wiring: one early hook in the request handler —
`if (url starts with /studio) → api.js / ui.js`. `options` pass-through keeps
tests able to inject `llm`, `ideaStore`, and renderer options.

## Tool routes

`POST /studio/{ideas,niche,channel,titles,description,tags,organize,script,
voice,keywords,transcript,thumbnails,save,status,faceless}` and
`GET /studio/ideas-list`. Request bodies use the same field names as the CLI
flags. Script/voice accept raw text in the body (`article`, `samples`)
instead of file paths.

## Testing

`test/studio-server.test.js` uses `createServer` on an ephemeral port with an
injected offline `StudioLlm`, temp `IdeaStore`, and mock renderer artifact
dir; covers page load, a representative tool call, invalid input, unknown
tool, ideas-list, and a faceless mock run.

## Risks

- Long faceless renders block the single request — acceptable for a local
  operator tool (mock is instant; moneyprinterturbo runs are operator-invoked
  and awaited deliberately, same as existing render routes).
