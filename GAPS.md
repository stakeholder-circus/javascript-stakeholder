> [!NOTE]
> Missing or deferred behavior must fail fast and be tracked explicitly. No placeholder behavior should mask absent parity work.

# Gaps

## Landed
- Shared deterministic engine is implemented and reused by the CLI and web server.
- Local web terminal app is implemented with ANSI DOM rendering, pane layout, and inspector views.
- Experimental provider runtime is implemented with encrypted local state, prompt assets, cache/provenance, manual session import, and browser bootstrap hooks.
- Docker now smokes both the CLI contract and the web server path.

## Remaining gaps
- The web terminal now documents live SSE session streaming, but provider bootstrapping and browser-driven consumer sessions still remain local-only and environment-dependent.
- Consumer profiles are provider-specific:
  - OpenAI consumer
  - Claude consumer
  - they are not yet portable across providers
- Consumer-session automation still depends on a locally available Playwright-compatible browser and provider-specific request templates.
- Official provider integration tests remain opt-in and require local credentials or encrypted profile configuration.
- `bun run web` is validated locally, but the script still launches the Node entrypoint rather than a Bun-specific server binary.
- Live-provider runtime remains outside deterministic follower CI today; contract tests and local/browser flows still need hardening before this lane can be treated as closed.

## Decision rules
- Deterministic mode stays the default.
- Experimental mode stays opt-in and out of parity fixtures.
- No repo-tracked secrets.
