# Error Model

## Categories
- invalid-argument
- unsupported-value
- missing-implementation
- interrupted
- internal-error

## Contract
- invalid input exits non-zero with a clear user-facing message
- missing implementation exits non-zero with a fail-fast explanation and a gap reference
- JSON mode may emit machine-readable diagnostics after the audit defines the final shape
