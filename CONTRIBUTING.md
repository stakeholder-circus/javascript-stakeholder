# Contributing

Keep deterministic behavior and experimental behavior separate.

## Required commands
- `npm run format`
- `npm run lint`
- `npm run build`
- `npm test`
- `npm run web`
- `npm run docker-test`

## Rules
- Keep the shared engine as the single source for CLI and web deterministic behavior.
- Do not put provider secrets, session cookies, or imported consumer material into repo-tracked files.
- Keep experimental provider work additive and opt-in.
- Keep `stakeholder-core` event-shape compatibility intact:
  - `eventType`
  - `sequence`
  - `message`
  - `timestamp`
  - `context`
- Update docs in the same pass when web, CLI, Docker, or provider behavior changes.
- Record residual gaps explicitly in [GAPS.md](/Users/davidsupan/shareholder/javascript-stakeholder/GAPS.md).
