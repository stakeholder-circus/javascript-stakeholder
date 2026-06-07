# Local web terminal app

The local web terminal is implemented inside `javascript-stakeholder` and shares the deterministic engine with the CLI.

## Implemented structure
- Shared engine:
  - family registry
  - seeded scheduler
  - normalized event model
  - family renderers
  - ANSI formatter/tokenizer
- Server:
  - Node/Bun-compatible HTTP server
  - static asset serving
  - session persistence
  - live SSE event streaming
  - experimental provider endpoints
- Browser app:
  - tmux-like pane layout
  - shell-like command prompt
  - ANSI DOM rendering
  - event/provenance inspector

## Endpoints
- `GET /api/list-values`
- `POST /api/sessions/static`
- `POST /api/sessions/experimental`
- `GET /api/sessions/:id/stream`
- `GET /api/sessions/:id/export`
- `GET /api/experimental/profiles`
- `POST /api/experimental/profiles`
- `GET /api/experimental/prompts`
- `POST /api/experimental/prompts`
- `POST /api/experimental/session-import`
- `POST /api/experimental/browser-bootstrap`

## Browser behavior
- The terminal pane renders ANSI-styled lines in HTML and CSS, not canvas.
- The inspector pane keeps selected event data, trace rows, and provenance visible.
- Browser local storage keeps benign UI state only; consumer session material is excluded.
- Experimental provider controls remain provider-specific, with separate OpenAI consumer and Claude consumer profiles.

## Current limitation
- The web terminal is one JavaScript-specific surface inside the broader live-provider program target; provider bootstrap and browser automation remain local-only for now.
- Consumer profiles are provider-specific and do not currently migrate between OpenAI consumer and Claude consumer flows.
