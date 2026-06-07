# Experimental provider mode

This is the current JavaScript implementation of the eventual full live-provider requirement across the program.

## Supported provider paths
- `local-demo`
- `openai-compatible`
- `anthropic`
- `openai-consumer`
- `claude-consumer`

## Provider-specific consumer profiles
- OpenAI consumer profile:
  - browser/session bootstrap for OpenAI consumer accounts
  - local export/import of profile material
  - provider-specific request templates
- Claude consumer profile:
  - browser/session bootstrap for Claude consumer accounts
  - local export/import of profile material
  - provider-specific request templates

## Stored state
- Encrypted files:
  - provider profiles
  - prompt assets and versions
  - personalization profiles
  - consumer session material
- SQLite runtime state:
  - cache entries
  - persisted sessions
  - provenance snapshots attached to cached responses

## Provenance fields
- provider
- model
- adapter mode
- prompt version
- cache hit or miss
- personalization profile
- timestamp
- prompt asset id

## Consumer-session paths
- Manual import:
  - session material can be posted into the encrypted store
- Browser bootstrap:
  - uses `playwright-core`
  - captures cookies and browser storage locally
  - remains local-only and excluded from CI pass/fail
- Profile isolation:
  - OpenAI consumer and Claude consumer profiles remain separate
  - cross-provider portability is not yet supported

## Rules
- No repo-tracked secrets.
- Default runtime never makes provider calls unless experimental inputs are supplied.
- Experimental outputs are never parity fixtures.
- Experimental browser automation is local-only and may require provider-specific request templates.
- The current implementation boundary does not guarantee portable consumer profiles across providers.
