# Docker

The Docker image remains CLI-first at entrypoint level, but the smoke gate now validates both CLI and web behavior.

## Commands
- `docker build -t javascript-stakeholder .`
- `docker run --rm javascript-stakeholder --list-values`
- `npm run docker-test`

## What `docker-test` proves
1. The image builds and runs lint, build, and test during image creation.
2. The default container entrypoint still supports the CLI contract.
3. A second container launch with `HOST=0.0.0.0` and `node src/web.js` serves:
   - `/`
   - `/api/list-values`
   - live SSE session streaming for browser clients

## Boundary notes
- Docker smoke covers the local web server path, not a full browser automation pass.
- Experimental provider integrations are not exercised in Docker unless local credentials and provider configuration are injected explicitly.
- OpenAI consumer and Claude consumer profiles remain local-only and provider-specific in this tranche.
