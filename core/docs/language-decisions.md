# Language Decisions

- Rust remains the canonical source of truth.
- Java and JavaScript are the active co-equal provider/runtime lanes today.
- Every language is expected to reach the full live-provider/runtime surface eventually, including Rust.
- Deterministic CI remains provider-free even while live-provider work advances.
- Java uses Java 25 with Maven Wrapper.
- .NET uses CLI-only projects.
- Swift uses SwiftPM only.
- Go uses modules and the standard library first.
- Python uses `pyproject.toml`, typing, dataclasses, and enums.
- JavaScript uses ESM and `node:test` first.
- Every implementation exposes deterministic hooks and normalized JSON output.
