# studio-web-ui Specification

## Purpose
TBD - created by archiving change studio-web-ui. Update Purpose after archive.
## Requirements
### Requirement: Studio page served by the control server
The control server SHALL serve an HTML studio page at `GET /studio` with a
form panel for every studio tool and the faceless workflow, requiring no
build step and no external assets.

#### Scenario: Page loads
- **WHEN** a browser requests `/studio`
- **THEN** the server returns 200 text/html containing panels for ideas, titles, tags, script, keywords, transcript, thumbnails, voice, ideas manager, and faceless run

### Requirement: Studio tool API
The control server SHALL expose `POST /studio/:tool` JSON endpoints that
dispatch to the existing studio modules and return their JSON results, and
`GET /studio/ideas-list` for the ideas manager. Unknown tools SHALL return
404; invalid input SHALL return 400 with the error message.

#### Scenario: Tool call succeeds
- **WHEN** `POST /studio/titles` receives `{"topic": "latte art"}`
- **THEN** the response is 200 with the same JSON the CLI would print

#### Scenario: Invalid input
- **WHEN** `POST /studio/titles` receives `{}`
- **THEN** the response is 400 with an error naming the missing field

#### Scenario: Unknown tool
- **WHEN** `POST /studio/bogus` is called
- **THEN** the response is 404

### Requirement: Faceless run from the browser
`POST /studio/faceless` SHALL run the faceless workflow with the mock engine
by default, accept an explicit engine override, and never trigger posting.

#### Scenario: Mock run from UI
- **WHEN** `POST /studio/faceless` receives `{"topic": "test"}`
- **THEN** the workflow runs with the mock engine and returns the run summary JSON

