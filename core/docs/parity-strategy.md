# Parity Strategy

## Priority order
1. strict CLI and event contract parity
2. normalized JSON event stream parity
3. deterministic seeded behavior
4. terminal presentation parity where it does not conflict with portability

## Normalization rules
- ignore terminal-specific ANSI differences in parity comparisons
- compare stable event ordering and payload semantics
- treat time, RNG, terminal, and signal handling as injectable dependencies
