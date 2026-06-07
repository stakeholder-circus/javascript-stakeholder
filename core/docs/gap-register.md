# Gap Register

| Scope | Gap | Status | Owner | Notes |
| --- | --- | --- | --- | --- |
| rust lane | Guarded live-provider runtime needs validation and hardening | open | orchestrator | runtime is wired locally in Rust but not yet validated against the Java and JavaScript lanes |
| javascript lane | Consumer-session browser automation remains local-only and provider-specific | open | javascript-stakeholder | no cross-provider portability yet |
| javascript lane | Live provider integration tests remain opt-in and secret-gated | open | javascript-stakeholder | deterministic CI stays provider-free |
