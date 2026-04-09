# Traceability

## Current implementation anchors
- Shared deterministic engine: [src/shared/engine.js](/Users/davidsupan/shareholder/javascript-stakeholder/src/shared/engine.js)
- CLI wrapper: [src/index.js](/Users/davidsupan/shareholder/javascript-stakeholder/src/index.js)
- Web server: [src/server/app.js](/Users/davidsupan/shareholder/javascript-stakeholder/src/server/app.js)
- Experimental provider runtime: [src/server/providers/index.js](/Users/davidsupan/shareholder/javascript-stakeholder/src/server/providers/index.js)
- Local encrypted state: [src/server/store/encrypted-files.js](/Users/davidsupan/shareholder/javascript-stakeholder/src/server/store/encrypted-files.js)
- Runtime SQLite state: [src/server/store/runtime-db.js](/Users/davidsupan/shareholder/javascript-stakeholder/src/server/store/runtime-db.js)

## Contract links
- Deterministic events remain aligned to `stakeholder-core/spec/event-schema.json`.
- CLI and web use the same scheduler and renderer selection path.
- Experimental mode adds provenance fields but does not alter the deterministic event shape.
- The web terminal is documented as live SSE streaming rather than replay-only playback.
- Consumer profiles are tracked separately for OpenAI consumer and Claude consumer modes.

## Remaining traceability work
- Add line-level Rust-to-JavaScript source rows for the web-specific presentation layer.
- Split deterministic and experimental trace rows more explicitly once the broader follower-language web surfaces exist.
