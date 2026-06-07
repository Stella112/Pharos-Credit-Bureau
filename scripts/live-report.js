import { fetchLivePharosProfile } from "../src/pharosLive.js";
import { scoreCounterparty, reviewActionWithCredit } from "../src/creditBureau.js";

function parseArgs(argv) {
  const args = {
    network: "pharos-mainnet",
    amountUsd: 0,
    knownContract: false,
    missionAligned: true
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--address") args.address = argv[++i];
    else if (arg === "--network") args.network = argv[++i];
    else if (arg === "--amount" || arg === "--amount-usd") args.amountUsd = Number(argv[++i]);
    else if (arg === "--label") args.label = argv[++i];
    else if (arg === "--known-contract") args.knownContract = true;
    else if (arg === "--unknown-contract") args.knownContract = false;
    else if (arg === "--mission-aligned") args.missionAligned = true;
    else if (arg === "--mission-misaligned") args.missionAligned = false;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function usage() {
  console.log(`Usage:
node scripts/live-report.js --address 0x... [--network pharos-mainnet] [--amount 5000] [--known-contract]

Examples:
node scripts/live-report.js --address 0x6b16be825b84d9a61b5ae370ea75dcd537555555 --amount 5000
node scripts/live-report.js --address 0x530d077fbe88add82736eb825fb1e202ed93b147 --amount 5000 --known-contract
`);
}

const args = parseArgs(process.argv.slice(2));
if (args.help || !args.address) {
  usage();
  process.exit(args.help ? 0 : 1);
}

const profile = await fetchLivePharosProfile({
  address: args.address,
  network: args.network,
  label: args.label
});

const report = scoreCounterparty(profile, { requestedExposureUsd: args.amountUsd || 10000 });
const sentinel = reviewActionWithCredit(
  {
    amountUsd: args.amountUsd || 0,
    network: profile.network,
    knownContract: args.knownContract,
    missionAligned: args.missionAligned
  },
  report
);

console.log(JSON.stringify({
  decisionSummary: sentinel.decision,
  liveSignals: profile.rawLiveSignals,
  explorerUrl: profile.explorerUrl,
  creditBureauReport: report,
  sentinelDecision: sentinel,
  generatedAt: new Date().toISOString()
}, null, 2));
