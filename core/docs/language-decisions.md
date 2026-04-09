# Language Decisions

- Java is the first-class implementation target.
- Java uses Java 25 with Maven Wrapper.
- .NET uses CLI-only projects.
- Swift uses SwiftPM only.
- Go uses modules and the standard library first.
- Python uses `pyproject.toml`, typing, dataclasses, and enums.
- JavaScript uses ESM and `node:test` first.
- Every implementation exposes deterministic hooks and normalized JSON output.
