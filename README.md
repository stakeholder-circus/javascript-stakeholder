> [!IMPORTANT]
> This repository is part of a Codex-assisted rewrite experiment. All changes are manually reviewed, a human remains in the loop, and missing behavior is tracked explicitly rather than hidden. The project exists for fun, research, language learning, AI agent workflow/planning, interop experiments, and code review testing.
# javascript-stakeholder

JavaScript implementation of the stakeholder runtime with a shared deterministic engine, a local tmux-like web terminal, and the current JavaScript live-provider/runtime lane. It is not the deterministic follower template, but it is part of the eventual full live-provider program for every language.

## Implemented surface
- ESM only.
- Shared engine for CLI and web.
- Deterministic seeded scheduler and normalized event output.
- Local web terminal app under `/src/web` with ANSI DOM rendering and live SSE session streaming.
- Workspace live-provider lane for browser-driven consumer capture, provider-side runtime behavior, and web-terminal evidence.
- Experimental provider runtime for:
  - `local-demo`
  - `openai-compatible`
  - `anthropic`
  - `openai-consumer`
  - `claude-consumer`
- Hybrid local state:
  - encrypted files for provider profiles, prompt assets, personalization profiles, and consumer session material
  - SQLite-backed runtime state for cache entries and saved sessions

## Commands
- `npm run format`
- `npm run lint`
- `npm run build`
- `npm test`
- `npm run web`
- `npm run docker-build`
- `npm run docker-test`
- `bun run build`
- `bun run web`
- `docker build -t javascript-stakeholder .`
- `docker run --rm javascript-stakeholder --list-values`

## Runtime modes
- Deterministic baseline:
  - CLI and web share the same scheduler, renderer selection, and normalized event model.
  - `--list-values` exposes the current value catalog.
- Experimental provider mode:
  - opt-in only
  - current JavaScript implementation of the eventual full live-provider requirement across the program
  - provenance and cache metadata stay attached to experimental events
  - consumer profiles remain provider-specific and local-only

## Web app
- Entry point: [src/web.js](/Users/davidsupan/shareholder/javascript-stakeholder/src/web.js)
- Browser UI: [src/web/index.html](/Users/davidsupan/shareholder/javascript-stakeholder/src/web/index.html)
- Start locally with `npm run web` or `bun run web`.
- The UI provides:
  - terminal pane
  - control pane
  - inspector pane
  - shell-like commands such as `run`, `rerun`, `clear`, `focus`, and `export session`
  - live SSE output rather than replay-only session playback

## Docs
- [Web terminal](/Users/davidsupan/shareholder/javascript-stakeholder/docs/web-terminal.md)
- [Experimental mode](/Users/davidsupan/shareholder/javascript-stakeholder/docs/experimental.md)
- [Tooling](/Users/davidsupan/shareholder/javascript-stakeholder/docs/tooling.md)
- [Docker](/Users/davidsupan/shareholder/javascript-stakeholder/docs/docker.md)
- [Traceability](/Users/davidsupan/shareholder/javascript-stakeholder/docs/traceability/README.md)
- [Gaps](/Users/davidsupan/shareholder/javascript-stakeholder/GAPS.md)
