import { readFile } from "node:fs/promises";
import { scoreCounterparty, reviewActionWithCredit } from "../src/creditBureau.js";

function usage() {
  console.error("Usage: node scripts/credit-report.js <request.json>");
}

const requestPath = process.argv[2];

if (!requestPath) {
  usage();
  process.exit(1);
}

const request = JSON.parse(await readFile(requestPath, "utf8"));

if (!request.profile) {
  throw new Error("Request must include a profile object.");
}

const report = scoreCounterparty(request.profile, request.context || {});
const sentinel = request.action
  ? reviewActionWithCredit(request.action, report, request.policy || {})
  : null;

const output = {
  decisionSummary: sentinel ? sentinel.decision : report.recommendation.action,
  creditBureauReport: report,
  sentinelDecision: sentinel,
  generatedAt: new Date().toISOString()
};

console.log(JSON.stringify(output, null, 2));
