# Scoring Rubric

Pharos Credit Bureau returns:

- `score`: 0-100 counterparty risk score.
- `confidence`: 0-100 confidence in available data.
- `riskBand`: `prime`, `low`, `moderate`, `watchlist`, or `high`.
- `recommendation`: proceed, cap exposure, require escrow, or reject.
- `exposureCapUsd`: maximum recommended exposure for the requested action.

## Factor Weights

| Factor | Weight | Signals |
| --- | ---: | --- |
| History | 18 | Wallet age, transaction count, Pharos interactions. |
| Reliability | 22 | Transaction success, escrow completion, delivery, failed transaction rate. |
| Liquidity | 16 | Stablecoin balance and 90-day average balance. |
| Risk Exposure | 20 | Unknown contracts, risky protocols, bridge failures, mixer/sanctions flags. |
| RealFi | 14 | Repayment history, RWA interactions, compliance attestations, defaults. |
| Data Quality | 10 | Source count, data freshness, transaction depth. |

## Risk Bands

| Score | Band | Default posture |
| ---: | --- | --- |
| 85-100 | prime | Proceed if Sentinel passes. |
| 70-84 | low | Proceed with ordinary policy limits. |
| 55-69 | moderate | Cap exposure or require escrow. |
| 40-54 | watchlist | Require escrow and user confirmation. |
| 0-39 | high | Reject unless the user explicitly overrides for a non-financial action. |

## Critical Flags

These flags can force rejection or heavy score penalties:

- sanctions match,
- mixer or obfuscation exposure,
- repayment default,
- high failed transaction rate,
- high escrow dispute rate,
- high risky-protocol exposure.

## Confidence

Confidence should drop when:

- data sources are missing,
- report data is stale,
- wallet age is short,
- transaction count is thin,
- factor scores disagree sharply.

Never treat missing data as clean history. Unknown means uncertain, not safe.

## Live RPC Mode

Live RPC mode observes only:

- chain ID,
- latest block,
- native balance,
- sent transaction count/nonce,
- deployed contract code.

It does not observe full credit history by itself. Unless a full indexer, escrow ledger, attestation registry, or compliance source is connected, the report should carry a `LIMITED_LIVE_DATA` flag and lower confidence.
