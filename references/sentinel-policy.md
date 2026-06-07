# Sentinel Policy

Sentinel reviews a proposed action after the bureau produces a credit report.

## Default Policy

| Field | Default |
| --- | --- |
| `allowedNetworks` | `pharos-mainnet`, `pharos-atlantic-testnet` |
| `maxSpendUsd` | `10000` |
| `requireKnownContract` | `true` |
| `requireMissionAlignment` | `true` |
| `requireFreshDataHours` | `24` |
| `rejectBelowScore` | `40` |
| `requireEscrowBelowScore` | `70` |
| `minimumConfidence` | `45` |

## Decisions

| Decision | Meaning |
| --- | --- |
| `approve` | The action is inside policy and credit limits. |
| `require_confirmation` | The action is possible but needs explicit user confirmation, escrow, or capped exposure. |
| `block` | The action violates policy and should not execute. |

## Block Conditions

Block when:

- the requested amount exceeds policy spend limit,
- the requested amount exceeds bureau exposure cap,
- the network is unsupported,
- the score is below reject threshold,
- confidence is below minimum,
- target contract is unknown while allowlisting is required,
- action is outside mission constraints,
- a critical credit or compliance flag exists.

For mainnet writes, require explicit user confirmation even when Sentinel returns `approve`.

