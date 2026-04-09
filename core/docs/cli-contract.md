# CLI Contract

## Required flags
| Flag | Type | Notes |
| --- | --- | --- |
| `--dev-type` | enum/string | required contract surface |
| `--jargon` | enum/string | required contract surface |
| `--complexity` | enum/string | required contract surface |
| `--duration` | integer | `0` means run until interrupted |
| `--alerts` | enum/string | required contract surface |
| `--project` | string | required contract surface |
| `--minimal` | boolean flag | styling reduction only |
| `--team` | enum/string | required contract surface |
| `--framework` | string | empty allowed |

## Allowed extras
| Flag | Type | Notes |
| --- | --- | --- |
| `--seed` | integer/string | deterministic runs |
| `--output-format` | `text|json` | normalized JSON for parity |
| `--no-color` | boolean flag | non-TTY safe |
| `--trace` | boolean flag | debug contract extension |
| `--list-values` | boolean flag | enumerate contract values |

## Behavioral rules
- invalid enum or flag values must fail clearly with non-zero exit
- `--duration 0` must run until interrupted
- minimal mode only reduces styling, not behavior
- normalized JSON parity dominates over ANSI parity
