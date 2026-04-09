# Tooling

## Standard commands
- `npm run format`
- `npm run lint`
- `npm run build`
- `npm test`
- `npm run web`
- `npm run docker-build`
- `npm run docker-test`
- `bun run build`
- `bun run web`

## Current gates
- `lint`: Biome check over `src`, `test`, and `scripts`
- `build`: syntax and importability check over runtime modules
- `test`: `node:test` coverage for CLI, engine, server, store, and experimental local-demo flow
- `docker-test`: image build, CLI `--list-values`, then web root and `/api/list-values` smoke
- `docker-test`: image build, CLI `--list-values`, then web root and `/api/list-values` smoke, with the web docs now describing live SSE session streaming

## Notes
- The repo stays dependency-light outside `sql.js` and `playwright-core`.
- `playwright-core` is only required for local browser bootstrap of consumer sessions.
- The build gate avoids importing browser-only UI modules directly and instead performs syntax checks on all JS modules.
