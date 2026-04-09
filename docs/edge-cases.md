# Edge Cases

- Duration `0` should keep the runtime interrupt-driven instead of inventing a bounded duration.
- `no-color` should remove ANSI color while preserving content and event order.
- `minimal` should reduce terminal chrome without changing the normalized event stream.
- Empty `framework` or `project` values should not crash the scheduler or invent unsupported families.
- Invalid CLI input should fail fast with a clear contract error.
- Experimental provider mode should fail clearly when a provider, model, or adapter mode is unsupported.
- Consumer session import should fail cleanly when the local material is invalid, stale, or expired.
- Browser reconnects should not change the normalized event sequence.
- Pane resize and scrollback changes should not mutate session data.
