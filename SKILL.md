---
name: pharos-credit-bureau
description: Generate Pharos counterparty credit reports and Sentinel-gated action decisions for wallets, AI agents, DAOs, protocols, and RealFi participants. Use when an agent must assess trust, reputation, creditworthiness, exposure limits, escrow requirements, lending/delegation/payment risk, or whether to interact with another wallet or protocol on Pharos.
---

# Pharos Credit Bureau

Produce an agent-readable credit report before funds, authority, liquidity, or work are delegated to a Pharos counterparty.

## Core Principle

The bureau scores counterparty risk. Sentinel gates execution.

Default to read-only analysis. Do not send a transaction, approve a contract interaction, or treat a score as execution permission without a concrete action review and user confirmation where required.

## Prerequisites

- **Node 18+** for the report CLIs and SDK; optional **Foundry** (`cast`) for raw on-chain reads.
- The subject address to assess. No private key is needed for analysis (read-only).
- Network and contract addresses resolve from `assets/networks.json`.

## Capability Index

| User Need | Capability | Detailed Instructions |
| --- | --- | --- |
| "assess a counterparty", "is this wallet/agent creditworthy", "can I trust / pay / lend to this address" | `node scripts/live-report.js --address <addr>` | → references/scoring-rubric.md |
| "score a structured profile", "rate this counterparty from data I have" | `node scripts/credit-report.js <request.json>` | → references/profile-schema.md |
| "should I let this action through", "gate a payment by credit / exposure" | SDK `reviewActionWithCredit` | → references/sentinel-policy.md |
| "read this address's on-chain history / settlement record" | live RPC + `cast logs` (Clearing House events) | → references/scoring-rubric.md |

## Bureau Flow

1. Capture the subject: wallet, agent, DAO, protocol, or counterparty address.
2. Capture the intended action: amount, asset, network, target contract, mission, deadline, and whether escrow is available.
3. Gather available signals from live Pharos RPC, Pharos indexers, escrow/task history, attestations, protocol registries, or user-provided profiles.
4. Build a profile using `references/profile-schema.md`.
5. Score the profile using `references/scoring-rubric.md`, `node scripts/live-report.js --address <addr>`, or `node scripts/credit-report.js <request.json>`.
6. Apply Sentinel using `references/sentinel-policy.md` or the SDK function `reviewActionWithCredit`.
7. Return a Credit Bureau Report and action decision in the output format below.

## Inputs

Required:

- network (`pharos-mainnet` or `pharos-atlantic-testnet`),
- subject address or profile,
- subject type (`wallet`, `agent`, `dao`, `protocol`, or `unknown`),
- intended action or interaction reason,
- requested exposure amount,
- available data sources and freshness.

Useful:

- wallet age,
- transaction counts and failure rate,
- stablecoin balances,
- escrow completion and dispute history,
- repayment history,
- RWA/compliance attestations,
- risky or unknown contract exposure,
- sanctions/mixer/compliance flags,
- whether a known contract or allowlist exists.

Use live mode for real addresses. Use `assets/credit-request-prime.json` and `assets/credit-request-risky.json` only as offline request templates.

## Live Pharos Report CLI

When the user provides an address, prefer live RPC mode:

```bash
node scripts/live-report.js --address 0x6b16be825b84d9a61b5ae370ea75dcd537555555 --network pharos-mainnet --amount 5000
```

Live mode fetches real Pharos chain ID, latest block, native balance, sent transaction count/nonce, and contract code from Pharos JSON-RPC. Public RPC cannot fully observe repayment history, escrow outcomes, sanctions, or token history; missing signals must lower confidence.

## Structured Report CLI

When Node.js is available and the user provides a structured request, prefer the CLI:

```bash
node scripts/credit-report.js assets/credit-request-prime.json
node scripts/credit-report.js assets/credit-request-risky.json
```

Request shape:

```json
{
  "profile": {},
  "context": { "requestedExposureUsd": 5000 },
  "action": {
    "amountUsd": 5000,
    "network": "pharos-mainnet",
    "knownContract": true,
    "missionAligned": true
  },
  "policy": {}
}
```

If full indexer/attestation data is unavailable, clearly label the report as live-RPC-limited or low-confidence. Do not fabricate clean repayment, escrow, compliance, or token history.

## Output Format

Return the result in this order:

1. Decision summary: proceed, cap exposure, require escrow, require confirmation, reject, or insufficient data.
2. Credit Bureau Report: score, confidence, risk band, exposure cap, main factors, and risk flags.
3. Sentinel Decision: approve, block, or require confirmation, with reasons.
4. Counterparty Profile: address, type, network, data sources, freshness, and assumptions.
5. Risk Analysis: reliability, liquidity, RealFi repayment, compliance, unknown-contract exposure, and operational history.
6. Exposure Policy: maximum recommended exposure, escrow requirement, monitoring interval, and exit condition.
7. Compliance Receipt: sanctions/KYC assumptions, privacy notes, blocked conditions.
8. Agent Accountability Ledger: signals used, confidence limits, dissenting risks, and final responsibility owner.
9. Execution Plan: read-only checks first; transaction plan only after explicit user request and Sentinel approval.
10. Mistake Memory: what would make the score wrong and what to monitor next.

## Sentinel Rules

Block or escalate when:

- the subject has a sanctions hit, mixer exposure, or default history,
- the network is unsupported,
- the target contract is unknown and policy requires allowlisting,
- the requested amount exceeds the bureau exposure cap,
- data is stale or confidence is below policy,
- the action is outside the user's stated mission,
- the user has not explicitly confirmed a mainnet write.

For moderate-risk counterparties, prefer capped exposure plus escrow over direct transfer.

## Bundled Resources

- `src/creditBureau.js`: reusable scoring and Sentinel review functions.
- `src/pharosLive.js`: live Pharos RPC profile collector.
- `scripts/live-report.js`: real-address live report CLI.
- `scripts/credit-report.js`: deterministic JSON report CLI.
- `scripts/demo.js`: compare bundled offline fixtures.
- `data/sample-profiles.json`: offline profiles for local UI fallback.
- `references/profile-schema.md`: supported profile fields.
- `references/scoring-rubric.md`: score and confidence model.
- `references/sentinel-policy.md`: execution gate policy.
- `index.html`: optional local dashboard demo.
