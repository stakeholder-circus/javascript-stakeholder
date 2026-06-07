# Traceability Matrix

| Source reference | Behavior | Target location | Rationale | Parity status |
| --- | --- | --- | --- | --- |
| `stakeholder-core` canonical CLI/event contract | deterministic CLI and normalized JSON baseline | `src/shared/engine.js`, `src/shared/catalog.js` | keep CLI and web on the same deterministic contract | active |
| `rust-stakeholder` current experimental surface | guarded live-provider concepts and catalog shape | `src/server/providers/*`, `src/server/store/*` | keep JavaScript aligned with the canonical live-provider model | active |
| `java-stakeholder` provider lane | JVM comparison lane for prompt/profile/cache/provenance behavior | `src/server/providers/*`, `src/server/store/*` | keep JavaScript and Java co-equal without silent drift | active |
