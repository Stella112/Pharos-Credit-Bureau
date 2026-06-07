const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const round = value => Math.round(value * 10) / 10;

const DEFAULT_POLICY = {
  allowedNetworks: ["pharos-mainnet", "pharos-atlantic-testnet"],
  maxSpendUsd: 10000,
  requireKnownContract: true,
  requireMissionAlignment: true,
  requireFreshDataHours: 24,
  rejectBelowScore: 40,
  requireEscrowBelowScore: 70,
  minimumConfidence: 45
};

const FACTOR_WEIGHTS = {
  history: 18,
  reliability: 22,
  liquidity: 16,
  riskExposure: 20,
  realFi: 14,
  dataQuality: 10
};

function scale(value, fullValue) {
  return clamp((Number(value || 0) / fullValue) * 100);
}

function ratio(numerator, denominator, fallback = 0) {
  if (!denominator) return fallback;
  return Number(numerator || 0) / Number(denominator || 1);
}

function getRiskBand(score) {
  if (score >= 85) return "prime";
  if (score >= 70) return "low";
  if (score >= 55) return "moderate";
  if (score >= 40) return "watchlist";
  return "high";
}

function getRecommendation(score, confidence, flags) {
  const hasCritical = flags.some(flag => flag.severity === "critical");

  if (hasCritical || score < 40) {
    return {
      action: "reject",
      label: "Reject",
      rationale: "Counterparty risk exceeds the bureau policy."
    };
  }

  if (confidence < 45 || score < 55) {
    return {
      action: "require_escrow",
      label: "Require escrow",
      rationale: "Available history is thin or risk is elevated."
    };
  }

  if (score < 70) {
    return {
      action: "cap_exposure",
      label: "Cap exposure",
      rationale: "Proceed only with a limited amount and tight monitoring."
    };
  }

  return {
    action: "proceed",
    label: "Proceed",
    rationale: "Counterparty behavior is inside the current bureau risk envelope."
  };
}

function buildFlags(profile) {
  const flags = [];
  const failedRate = ratio(profile.failedTransactions, profile.transactionCount);
  const disputeRate = ratio(profile.escrowsDisputed, profile.escrowsCompleted + profile.escrowsDisputed);
  const observedSignals = profile.observedSignals || {};

  if (profile.liveDataMode && observedSignals.scope !== "full-indexer") {
    flags.push({
      severity: "medium",
      code: "LIMITED_LIVE_DATA",
      message: "Live report uses public RPC signals only; repayment, escrow, compliance, and token history were not fully observed."
    });
  }

  if (profile.sanctionsHit) {
    flags.push({
      severity: "critical",
      code: "SANCTIONS_MATCH",
      message: "Compliance screen returned a sanctions match."
    });
  }

  if (profile.mixerInteractions > 0) {
    flags.push({
      severity: "critical",
      code: "MIXER_EXPOSURE",
      message: "Address interacted with mixer or obfuscation contracts."
    });
  }

  if (profile.defaults > 0) {
    flags.push({
      severity: "critical",
      code: "DEFAULT_HISTORY",
      message: "Repayment default detected in structured history."
    });
  }

  if (failedRate > 0.18) {
    flags.push({
      severity: "high",
      code: "FAILED_TX_RATE",
      message: "Failed transaction rate is materially above policy."
    });
  }

  if (disputeRate > 0.2) {
    flags.push({
      severity: "high",
      code: "ESCROW_DISPUTES",
      message: "Escrow dispute rate is high for available history."
    });
  }

  if (profile.riskyProtocolExposurePct > 0.35) {
    flags.push({
      severity: "high",
      code: "RISKY_PROTOCOL_EXPOSURE",
      message: "Recent activity has high exposure to risky contracts or farms."
    });
  }

  if (profile.unknownContractInteractions90d > 15) {
    flags.push({
      severity: "medium",
      code: "UNKNOWN_CONTRACTS",
      message: "Frequent interaction with unknown or unverified contracts."
    });
  }

  if (profile.lastUpdatedHoursAgo > 24) {
    flags.push({
      severity: "medium",
      code: "STALE_DATA",
      message: "Credit profile data is older than the recommended freshness window."
    });
  }

  if (profile.walletAgeDays !== undefined && profile.walletAgeDays < 30) {
    flags.push({
      severity: "medium",
      code: "NEW_WALLET",
      message: "Wallet or agent identity has limited operating history."
    });
  }

  if (profile.liveDataMode && Number(profile.transactionCount || 0) === 0) {
    flags.push({
      severity: "medium",
      code: "NO_SENT_TX_HISTORY",
      message: "Live RPC nonce shows no sent transaction history for this address."
    });
  }

  if (profile.contractCodePresent) {
    flags.push({
      severity: "medium",
      code: "CONTRACT_ACCOUNT",
      message: "Address has deployed contract code; review protocol/admin risk before funds move."
    });
  }

  return flags;
}

function factorScore(profile) {
  const observedSignals = profile.observedSignals || null;
  const observed = signal => !observedSignals || Boolean(observedSignals[signal]);
  const totalTransactions = Number(profile.transactionCount || 0);
  const failedRate = ratio(profile.failedTransactions, totalTransactions);
  const successRate = ratio(profile.successfulTransactions, totalTransactions, 0.5);
  const totalEscrows = Number(profile.escrowsCompleted || 0) + Number(profile.escrowsDisputed || 0);
  const escrowSuccessRate = ratio(profile.escrowsCompleted, totalEscrows, totalEscrows ? 0 : 0.5);
  const repaymentTotal = Number(profile.repaymentsOnTime || 0) + Number(profile.repaymentsLate || 0) + Number(profile.defaults || 0);
  const repaymentScore = ratio(profile.repaymentsOnTime, repaymentTotal, repaymentTotal ? 0 : 0.5);
  const successComponent = observed("txOutcomes") ? successRate * 100 : totalTransactions ? clamp(35 + scale(totalTransactions, 300) * 0.25) : 20;
  const escrowComponent = observed("escrowHistory") ? escrowSuccessRate * 100 : 25;
  const deliveryComponent = observed("deliveryHistory") ? Number(profile.onTimeDeliveryRate || 0) * 100 : 25;
  const failedComponent = observed("txOutcomes") ? clamp(100 - failedRate * 260) : 35;
  const unknownContractsComponent = observed("contractRisk") ? clamp(100 - Number(profile.unknownContractInteractions90d || 0) * 4) : 35;
  const riskyProtocolComponent = observed("protocolRisk") ? clamp(100 - Number(profile.riskyProtocolExposurePct || 0) * 140) : 35;
  const bridgeComponent = observed("bridgeRisk") ? clamp(100 - Number(profile.bridgeFailureCount || 0) * 18) : 45;
  const complianceComponent = observed("compliance") ? (profile.sanctionsHit ? 0 : 100) : 30;
  const mixerComponent = observed("compliance") ? (profile.mixerInteractions ? 0 : 100) : 30;
  const repaymentComponent = observed("repaymentHistory") ? repaymentScore * 100 : 25;
  const rwaComponent = observed("rwaHistory") ? scale(profile.rwaProtocolInteractions, 10) : 20;
  const attestationComponent = observed("compliance") ? scale(profile.complianceAttestations, 3) : 20;
  const defaultComponent = observed("repaymentHistory") ? (profile.defaults ? 0 : 100) : 25;

  const scores = {
    history: (
      scale(profile.walletAgeDays, 365) * 0.42 +
      scale(profile.transactionCount, 750) * 0.38 +
      scale(profile.pharosInteractions, 250) * 0.2
    ),
    reliability: (
      successComponent * 0.32 +
      escrowComponent * 0.28 +
      deliveryComponent * 0.24 +
      failedComponent * 0.16
    ),
    liquidity: (
      scale(profile.stablecoinBalanceUsd, 50000) * 0.58 +
      scale(profile.averageBalanceUsd90d, 35000) * 0.42
    ),
    riskExposure: (
      riskyProtocolComponent * 0.36 +
      unknownContractsComponent * 0.3 +
      bridgeComponent * 0.16 +
      mixerComponent * 0.1 +
      complianceComponent * 0.08
    ),
    realFi: (
      repaymentComponent * 0.36 +
      rwaComponent * 0.26 +
      attestationComponent * 0.24 +
      defaultComponent * 0.14
    ),
    dataQuality: (
      scale((profile.dataSources || []).length, 4) * 0.48 +
      clamp(100 - Number(profile.lastUpdatedHoursAgo || 0) * 3) * 0.34 +
      scale(profile.transactionCount, 250) * 0.18
    )
  };

  return Object.entries(scores).map(([name, score]) => ({
    name,
    score: round(clamp(score)),
    weight: FACTOR_WEIGHTS[name]
  }));
}

function calculateConfidence(profile, factors, flags) {
  const sourceScore = scale((profile.dataSources || []).length, 4);
  const freshnessScore = clamp(100 - Number(profile.lastUpdatedHoursAgo || 0) * 3.5);
  const historyDepth = (scale(profile.transactionCount, 300) + scale(profile.walletAgeDays, 180)) / 2;
  const uncertaintyPenalty = flags.filter(flag => flag.code === "STALE_DATA" || flag.code === "NEW_WALLET").length * 12;
  const factorVariance = Math.max(...factors.map(factor => factor.score)) - Math.min(...factors.map(factor => factor.score));

  return round(clamp(
    sourceScore * 0.34 +
    freshnessScore * 0.28 +
    historyDepth * 0.28 +
    clamp(100 - factorVariance) * 0.1 -
    uncertaintyPenalty
  ));
}

function calculateExposureCap(profile, score, confidence, context = {}) {
  const requestedExposureUsd = Number(context.requestedExposureUsd || 10000);
  const stablecoinBalanceUsd = Number(profile.stablecoinBalanceUsd || 0);

  let scoreCapPct = 0;
  if (score >= 85) scoreCapPct = 1;
  else if (score >= 70) scoreCapPct = 0.65;
  else if (score >= 55) scoreCapPct = 0.32;
  else if (score >= 40) scoreCapPct = 0.12;

  const confidenceHaircut = confidence >= 75 ? 1 : confidence >= 55 ? 0.75 : 0.45;
  const balanceCap = stablecoinBalanceUsd > 0 ? stablecoinBalanceUsd * 0.35 : requestedExposureUsd * 0.1;
  const proposedCap = requestedExposureUsd * scoreCapPct * confidenceHaircut;

  return Math.floor(Math.max(0, Math.min(requestedExposureUsd, balanceCap, proposedCap)));
}

export function scoreCounterparty(profile, context = {}) {
  const flags = buildFlags(profile);
  const factors = factorScore(profile);
  const weightedScore = factors.reduce((sum, factor) => {
    return sum + factor.score * (factor.weight / 100);
  }, 0);

  const criticalPenalty = flags.filter(flag => flag.severity === "critical").length * 18;
  const highPenalty = flags.filter(flag => flag.severity === "high").length * 6;
  const score = round(clamp(weightedScore - criticalPenalty - highPenalty));
  const confidence = calculateConfidence(profile, factors, flags);
  const recommendation = getRecommendation(score, confidence, flags);
  const exposureCapUsd = calculateExposureCap(profile, score, confidence, context);

  return {
    profile: {
      address: profile.address,
      label: profile.label,
      type: profile.type,
      network: profile.network,
      dataSources: profile.dataSources || [],
      lastUpdatedHoursAgo: profile.lastUpdatedHoursAgo
    },
    score,
    confidence,
    riskBand: getRiskBand(score),
    recommendation,
    exposureCapUsd,
    flags,
    factors,
    assumptions: [
      "Scores are generated from available onchain and structured history.",
      "Missing data lowers confidence instead of being treated as clean history.",
      "Exposure caps are advisory until Sentinel reviews a concrete action."
    ]
  };
}

export function reviewActionWithCredit(action, creditReport, policy = {}) {
  const rules = { ...DEFAULT_POLICY, ...policy };
  const reasons = [];
  const checks = [];

  function addCheck(name, passed, passDetail, failDetail = passDetail) {
    checks.push({ name, passed, detail: passed ? passDetail : failDetail });
    if (!passed) reasons.push(failDetail);
  }

  const amountUsd = Number(action.amountUsd || 0);
  const hasStaleData = creditReport.flags.some(flag => flag.code === "STALE_DATA");

  addCheck(
    "network",
    rules.allowedNetworks.includes(action.network),
    `Network ${action.network || "unknown"} is allowed.`,
    `Unsupported network: ${action.network || "unknown"}.`
  );
  addCheck(
    "budget",
    amountUsd <= Number(rules.maxSpendUsd || 0),
    `Amount ${amountUsd} is within policy max spend ${rules.maxSpendUsd}.`,
    `Amount ${amountUsd} exceeds policy max spend ${rules.maxSpendUsd}.`
  );
  addCheck(
    "credit_cap",
    amountUsd <= Number(creditReport.exposureCapUsd || 0),
    `Amount ${amountUsd} is within bureau exposure cap ${creditReport.exposureCapUsd}.`,
    `Amount ${amountUsd} exceeds bureau exposure cap ${creditReport.exposureCapUsd}.`
  );
  addCheck(
    "minimum_score",
    creditReport.score >= rules.rejectBelowScore,
    `Credit score ${creditReport.score} is above reject threshold ${rules.rejectBelowScore}.`,
    `Credit score ${creditReport.score} is below reject threshold ${rules.rejectBelowScore}.`
  );
  addCheck(
    "confidence",
    creditReport.confidence >= rules.minimumConfidence,
    `Confidence ${creditReport.confidence} meets required ${rules.minimumConfidence}.`,
    `Confidence ${creditReport.confidence} is below required ${rules.minimumConfidence}.`
  );
  addCheck(
    "freshness",
    !hasStaleData,
    "Credit profile data is inside the freshness window.",
    `Credit profile data is older than the ${rules.requireFreshDataHours}-hour freshness policy.`
  );
  addCheck(
    "known_contract",
    !rules.requireKnownContract || Boolean(action.knownContract),
    "Target contract is known or allowlisted.",
    "Target contract is not marked as known or allowlisted."
  );
  addCheck(
    "mission",
    !rules.requireMissionAlignment || Boolean(action.missionAligned),
    "Action is aligned with the declared mission constraints.",
    "Action is outside the declared mission constraints."
  );

  const hasCriticalFlag = creditReport.flags.some(flag => flag.severity === "critical");
  addCheck(
    "critical_flags",
    !hasCriticalFlag,
    "No critical credit or compliance flags are present.",
    "Critical credit or compliance flag is present."
  );

  let decision = "approve";
  if (reasons.length) decision = "block";
  else if (
    creditReport.score < rules.requireEscrowBelowScore ||
    creditReport.recommendation.action === "require_escrow" ||
    creditReport.recommendation.action === "cap_exposure"
  ) {
    decision = "require_confirmation";
    reasons.push("Credit report requires capped exposure, escrow, or user confirmation.");
  }

  return {
    decision,
    action,
    reasons,
    checks,
    finalInstruction:
      decision === "approve"
        ? "Execution is allowed by current policy."
        : decision === "require_confirmation"
          ? "Ask the user to confirm the capped action before execution."
          : "Do not execute this action."
  };
}

export { DEFAULT_POLICY };
