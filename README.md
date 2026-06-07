# Pharos Credit Bureau

Counterparty risk intelligence for AI agents on Pharos.

Pharos Credit Bureau scores wallets, agents, protocols, and RealFi counterparties before an agent lends, hires, delegates, routes, or releases funds. It produces a risk band, confidence score, risk flags, recommended exposure cap, and a Sentinel-gated execution decision.

## MVP Demo

The demo compares three counterparties:

- `Atlas Treasury Ops`: strong operating history and clean RealFi behavior.
- `Nova Settlement Agent`: usable but needs capped exposure or escrow.
- `Flash Yield Bot`: rejected because of thin history, risky exposure, and credit flags.

Sentinel then reviews a proposed onchain action against the credit report. It can:

- approve,
- require confirmation,
- block.

## Run Locally

```bash
npm start
```

Open `http://localhost:4173`.

Run the CLI demo:

```bash
npm run demo
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
├── data/sample-profiles.json
├── index.html
├── scripts/demo.js
├── scripts/serve.js
├── src/app.js
├── src/creditBureau.js
├── src/styles.css
└── tests/creditBureau.test.js
```

## Next Build Steps

- Replace sample profiles with a Pharos indexer adapter.
- Add a contract/protocol allowlist registry.
- Add signed credit receipts for agent workflows.
- Store completed escrow outcomes as bureau input.
- Add API mode for Pharos Agent Center integrations.

