# Profile Schema

Use these fields when building a counterparty profile. Missing fields are allowed, but missing data should lower confidence.

## Identity

| Field | Type | Meaning |
| --- | --- | --- |
| `address` | string | Wallet, agent, DAO, or protocol address. |
| `label` | string | Human-readable name when known. |
| `type` | string | `wallet`, `agent`, `dao`, `protocol`, or `unknown`. |
| `network` | string | `pharos-mainnet` or `pharos-atlantic-testnet`. |

## Operating History

| Field | Type | Meaning |
| --- | --- | --- |
| `walletAgeDays` | number | Days since first observed activity. |
| `transactionCount` | number | Total observed transactions. |
| `pharosInteractions` | number | Pharos-native interactions. |
| `successfulTransactions` | number | Successful transactions. |
| `failedTransactions` | number | Failed transactions. |

## Liquidity and RealFi

| Field | Type | Meaning |
| --- | --- | --- |
| `stablecoinBalanceUsd` | number | Current stablecoin balance estimate. |
| `averageBalanceUsd90d` | number | 90-day average stablecoin balance estimate. |
| `repaymentsOnTime` | number | Completed on-time repayments. |
| `repaymentsLate` | number | Late repayments. |
| `defaults` | number | Known repayment defaults. |
| `rwaProtocolInteractions` | number | RWA or RealFi protocol interactions. |
| `complianceAttestations` | number | Valid attestations or credentials observed. |

## Agent Work and Escrow

| Field | Type | Meaning |
| --- | --- | --- |
| `escrowsCompleted` | number | Completed escrow/task outcomes. |
| `escrowsDisputed` | number | Disputed escrow/task outcomes. |
| `onTimeDeliveryRate` | number | Decimal from `0` to `1`. |

## Risk and Compliance

| Field | Type | Meaning |
| --- | --- | --- |
| `unknownContractInteractions90d` | number | Interactions with unverified/unknown contracts in the last 90 days. |
| `riskyProtocolExposurePct` | number | Decimal exposure estimate from `0` to `1`. |
| `bridgeFailureCount` | number | Failed bridge or route events. |
| `mixerInteractions` | number | Mixer or obfuscation interactions. |
| `sanctionsHit` | boolean | Whether a compliance screen matched a sanctioned entity. |

## Data Quality

| Field | Type | Meaning |
| --- | --- | --- |
| `dataSources` | string[] | Sources used, such as indexer, escrow ledger, attestation registry. |
| `lastUpdatedHoursAgo` | number | Freshness of the newest report data. |

## Live RPC Fields

| Field | Type | Meaning |
| --- | --- | --- |
| `liveDataMode` | boolean | Whether the report was built from live Pharos RPC. |
| `nativeBalance` | string | Native token balance returned by RPC. |
| `nativeToken` | string | `PROS` for mainnet or `PHRS` for Atlantic testnet. |
| `latestBlock` | number | Latest observed block number. |
| `contractCodePresent` | boolean | Whether `eth_getCode` returned deployed code. |
| `explorerUrl` | string | Explorer URL for the subject address. |
| `observedSignals` | object | Which risk dimensions were actually observed. Missing dimensions lower confidence. |
| `rawLiveSignals` | object | Raw live RPC facts included for auditability. |
