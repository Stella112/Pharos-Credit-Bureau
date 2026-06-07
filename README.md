# Pharos Credit Bureau Skill

Counterparty risk intelligence for AI agents on Pharos.

This repository is a Codex Skill. The main entry point is [`SKILL.md`](./SKILL.md). Pharos Credit Bureau scores wallets, agents, protocols, and RealFi counterparties before an agent lends, hires, delegates, routes, or releases funds. It produces a risk band, confidence score, risk flags, recommended exposure cap, and a Sentinel-gated execution decision.

## Skill Invocation

Install from GitHub:

```bash
npx skills add https://github.com/Stella112/Pharos-Credit-Bureau
```

For Codex global installation:

```bash
npx skills add https://github.com/Stella112/Pharos-Credit-Bureau -a codex -g -y
```

Use:

```text
$pharos-credit-bureau
```

Example:

```text
Use $pharos-credit-bureau to assess this Pharos agent before I send 5,000 USDC. Tell me whether to proceed, cap exposure, require escrow, or reject.
```

## Live Demo

Run a real-address report from Pharos RPC:

```bash
npm run live -- --address 0x6b16be825b84d9a61b5ae370ea75dcd537555555 --amount 5000
```

Run another real address:

```bash
npm run live -- --address 0x530d077fbe88add82736eb825fb1e202ed93b147 --amount 5000 --known-contract
```

Live mode fetches real Pharos chain ID, latest block, native balance, sent transaction count/nonce, and contract code from Pharos JSON-RPC. It does not fabricate repayment, escrow, token, sanctions, or attestation data. Missing signals lower confidence.

Browser JSON endpoint after `npm start`:

```text
http://localhost:4173/api/live-report?address=0x6b16be825b84d9a61b5ae370ea75dcd537555555&amount=5000
```

Sentinel then reviews a proposed onchain action against the credit report. It can:

- approve,
- require confirmation,
- block.

## Run Locally

```bash
npm start
```

Open `http://localhost:4173`.

Run the offline comparison:

```bash
npm run demo
```

Generate an offline deterministic skill report from a request file:

```bash
npm run report -- assets/credit-request-prime.json
npm run report -- assets/credit-request-risky.json
```

Run tests:

```bash
npm test
```

## Scoring Model

The bureau scores six weighted factors:

| Factor | Weight | Signal examples |
| --- | ---: | --- |
| History | 18 | wallet age, transaction count, Pharos activity |
| Reliability | 22 | success rate, escrow completion, delivery history |
| Liquidity | 16 | stablecoin balance, average balance |
| Risk Exposure | 20 | unknown contracts, risky protocols, bridge failures |
| RealFi | 14 | repayment record, RWA activity, compliance attestations |
| Data Quality | 10 | source count, freshness, depth |

Missing data lowers confidence. Critical flags can force a rejection even if a raw factor score looks acceptable.

## Sentinel Gate

`reviewActionWithCredit` checks:

- allowed Pharos network,
- policy spend limit,
- bureau exposure cap,
- minimum score,
- confidence,
- known contract status,
- mission alignment,
- critical flags.

This keeps the bureau useful for AI-native execution without pretending an advisory score is enough to send a transaction.

## Project Shape

```text
.
├── SKILL.md
├── agents/openai.yaml
├── assets/credit-request-prime.json
├── assets/credit-request-risky.json
├── data/sample-profiles.json
├── index.html
├── references/profile-schema.md
├── references/scoring-rubric.md
├── references/sentinel-policy.md
├── scripts/credit-report.js
├── scripts/demo.js
├── scripts/serve.js
├── src/app.js
├── src/creditBureau.js
├── src/styles.css
└── tests/creditBureau.test.js
```

## Next Build Steps

- Replace sample profiles with a Pharos indexer adapter.
- Add optional SocialScan API support for transaction history when an API key is available.
- Add a contract/protocol allowlist registry.
- Add signed credit receipts for agent workflows.
- Store completed escrow outcomes as bureau input.
- Add API mode for Pharos Agent Center integrations.
