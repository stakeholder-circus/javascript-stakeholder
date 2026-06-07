# Source Audit Baseline

## Canonical sources in current use
- Rust source of truth:
  - local checkout: `/Users/davidsupan/shareholder/rust-stakeholder`
  - default branch: `master`
- Java comparative provider/runtime lane:
  - local checkout: `/Users/davidsupan/shareholder/java-stakeholder`
  - default branch: `main`

## Audit status
- Rust deterministic generator and experimental provider surfaces are actively audited in the workspace.
- Java provides the current JVM comparison lane for provider/runtime behavior.
- The JavaScript repo mirrors current audit decisions here, but canonical planning and cross-repo traceability live in `stakeholder-core`.
