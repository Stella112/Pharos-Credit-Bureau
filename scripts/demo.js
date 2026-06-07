import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { scoreCounterparty, reviewActionWithCredit } from "../src/creditBureau.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const profiles = JSON.parse(await readFile(join(__dirname, "../data/sample-profiles.json"), "utf8"));

const scenarios = profiles.map(profile => {
  const report = scoreCounterparty(profile, { requestedExposureUsd: 5000 });
  const sentinel = reviewActionWithCredit(
    {
      amountUsd: 5000,
      network: "pharos-mainnet",
      knownContract: true,
      missionAligned: true
    },
    report
  );

  return {
    counterparty: profile.label,
    score: report.score,
    confidence: report.confidence,
    riskBand: report.riskBand,
    recommendation: report.recommendation.label,
    exposureCapUsd: report.exposureCapUsd,
    sentinel: sentinel.decision,
    reasons: sentinel.reasons
  };
});

console.table(scenarios.map(({ reasons, ...row }) => row));
for (const scenario of scenarios) {
  console.log(`\n${scenario.counterparty}`);
  console.log(`Sentinel: ${scenario.sentinel}`);
  console.log(scenario.reasons.length ? scenario.reasons.join("\n") : "Execution is allowed by current policy.");
}

