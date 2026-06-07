import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { scoreCounterparty, reviewActionWithCredit } from "../src/creditBureau.js";

const profiles = JSON.parse(await readFile(new URL("../data/sample-profiles.json", import.meta.url), "utf8"));

test("scores a trusted profile above a risky profile", () => {
  const trusted = scoreCounterparty(profiles[0], { requestedExposureUsd: 5000 });
  const risky = scoreCounterparty(profiles[2], { requestedExposureUsd: 5000 });

  assert.ok(trusted.score > risky.score);
  assert.equal(risky.recommendation.action, "reject");
});

test("sentinel blocks actions above the exposure cap", () => {
  const report = scoreCounterparty(profiles[1], { requestedExposureUsd: 10000 });
  const review = reviewActionWithCredit(
    {
      amountUsd: report.exposureCapUsd + 1000,
      network: "pharos-mainnet",
      knownContract: true,
      missionAligned: true
    },
    report
  );

  assert.equal(review.decision, "block");
  assert.ok(review.reasons.some(reason => reason.includes("exceeds bureau exposure cap")));
});

test("sentinel blocks unknown contracts when policy requires allowlisting", () => {
  const report = scoreCounterparty(profiles[0], { requestedExposureUsd: 1000 });
  const review = reviewActionWithCredit(
    {
      amountUsd: 1000,
      network: "pharos-mainnet",
      knownContract: false,
      missionAligned: true
    },
    report
  );

  assert.equal(review.decision, "block");
});

